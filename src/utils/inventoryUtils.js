import { supabase } from '../lib/supabaseClient';
import { getSyncedParts } from './partSyncUtils';
import { format } from 'date-fns';

/**
 * 브랜드 설정 조회
 */
export const getBrandSettings = async (brandCode) => {
  try {
    const { data, error } = await supabase
      .from('brand_settings')
      .select('*')
      .eq('brand_code', brandCode)
      .single();

    if (error) {
      console.error('브랜드 설정 조회 실패:', error);
      return { auto_inventory_deduction: false };
    }

    return data;
  } catch (err) {
    console.error('브랜드 설정 조회 중 오류:', err);
    return { auto_inventory_deduction: false };
  }
};

/**
 * 다중 창고 기반 재고 증감 처리 (차감 또는 복구)
 * @param {string} warehouseId - 창고 ID
 * @param {Array} parts - 처리할 부품 목록 [{ part_id, part_name, part_code, quantity }]
 * @param {string} brandCode - 브랜드 코드
 * @param {string} referenceId - 참조 ID (shipment_id 또는 service_id)
 * @param {string} referenceType - 참조 타입 ('shipment' 또는 'service')
 * @param {string} changeType - 변경 타입 ('shipment_complete', 'service_complete', 'shipment_revert', 'service_revert')
 * @param {boolean} isRevert - 복구 여부 (true: 재고 증가, false: 재고 차감)
 */
export const processInventory = async (defaultWarehouseId, parts, brandCode, referenceId, referenceType, changeType, isRevert = false, customerName = '', displayRefId = '') => {
  const refStr = displayRefId || referenceId;
  if (!defaultWarehouseId) {
    return {
      success: false,
      message: '출고 창고(warehouse_id)가 지정되지 않았습니다.',
      errors: ['missing_warehouse'],
      results: [],
      error_count: parts.length
    };
  }

  try {
    const results = [];
    const errors = [];

    for (const part of parts) {
      const inferredBrandCode = brandCode || (
        (part.part_code && (part.part_code.toUpperCase().startsWith('NB') || part.part_code.toUpperCase().includes('NEARBIKE'))) ||
        (part.part_name && (part.part_name.toUpperCase().startsWith('NB') || part.part_name.includes('니어'))) 
        ? 'NB' : 'XRB'
      );

      if (!part.part_id) {
        const quantityChange = isRevert ? part.quantity : -part.quantity;
        // 트랜잭션만 기록
        const { error: txError } = await supabase.from('transactions').insert({
          group_id: referenceId || null,
          type: isRevert ? 'in' : 'out',
          product_id: null,
          product_name: part.part_name,
          product_code: part.part_code,
          product_supplier: inferredBrandCode,
          quantity: Math.abs(quantityChange),
          from_location: isRevert ? '외부(취소/환불)' : (part.warehouse_id || defaultWarehouseId),
          to_location: isRevert ? (part.warehouse_id || defaultWarehouseId) : '외부(고객)',
          date: format(new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"})), 'yyyy-MM-dd'),
          note: isRevert 
            ? `${referenceType === 'shipment' ? '[매장출고 취소]' : '[A/S 취소]'} 단순 기록 (Ref: ${refStr}${customerName ? `, ${customerName}` : ''})`
            : `${referenceType === 'shipment' ? '[매장출고 완료]' : '[A/S 완료]'} 단순 기록 (Ref: ${refStr}${customerName ? `, ${customerName}` : ''})`,
          is_grouped: true,
          status: '완료'
        });
        if (txError) console.error('입출고 거래내역(미등록 부품) 기록 실패:', txError);
        
        results.push({
          part_id: null,
          part_name: part.part_name,
          previous_quantity: 0,
          new_quantity: 0,
          changed_quantity: Math.abs(quantityChange),
          change_type: isRevert ? 'restored' : 'deducted',
          success: true,
          synced_parts_count: 0
        });
        continue;
      }

      try {
        // 현재 창고 재고 조회
        const { error: stockGrpError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('warehouse_id', part.warehouse_id || defaultWarehouseId)
          .eq('product_id', part.part_id)
          .maybeSingle();

        if (stockGrpError && stockGrpError.code !== 'PGRST116') {
          console.error(`[Inventory] 재고 조회 에러 (부품: ${part.part_name}):`, stockGrpError);
        }

        const quantityChange = isRevert ? part.quantity : -part.quantity;

        // 연동된 파츠 조회
        const syncedParts = await getSyncedParts(part.part_id);
        const allPartIds = [part.part_id, ...syncedParts.map(sp => sp.part.id)];

        // 모든 파츠(기본 + 연동) 재고 업데이트 (inventory 테이블)
        const updatePromises = allPartIds.map(async (pId) => {
           return supabase.rpc('adjust_inventory', {
             p_warehouse_id: part.warehouse_id || defaultWarehouseId,
             p_product_id: pId,
             p_quantity_change: quantityChange
           });
        });

        const updateResults = await Promise.all(updatePromises);
        const updateErrors = updateResults.filter(r => r.error);

        if (updateErrors.length > 0) {
          const errorMessages = updateErrors.map(e => e.error.message).join(', ');
          errors.push(`부품 ${part.part_name} 및 연동 파츠 재고 업데이트 실패: ${errorMessages}`);
          continue;
        }

        // RPC 결과에서 메인 파츠의 실제 결과(새 수량) 추출
        const mainPartResult = updateResults.find((r, idx) => allPartIds[idx] === part.part_id)?.data?.[0];
        const newQuantity = mainPartResult ? (mainPartResult.out_quantity !== undefined ? mainPartResult.out_quantity : mainPartResult.quantity) : 0;
        const previousQuantity = newQuantity - quantityChange;

        // 재고 로그 기록
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert({
            part_id: null, // 외래키/타입(uuid) 충돌 방지를 위해 임시 null 처리 (향후 DB 타입 변경 필요)
            part_name: part.part_name,
            part_code: part.part_code,
            brand_code: inferredBrandCode,
            change_type: changeType,
            quantity_change: quantityChange,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity,
            reference_id: referenceId,
            reference_type: referenceType,
            notes: isRevert 
              ? `${referenceType === 'shipment' ? '출고' : 'A/S'} 상태 되돌림으로 인한 재고 복구${syncedParts.length > 0 ? ` (연동 파츠 ${syncedParts.length}개 포함)` : ''}`
              : `${referenceType === 'shipment' ? '출고' : 'A/S'} 검수 확인 후 자동 차감${syncedParts.length > 0 ? ` (연동 파츠 ${syncedParts.length}개 포함)` : ''}`
          });

        if (logError) {
          console.error('재고 로그 기록 실패:', logError);
        }

        // 트랜잭션 (입출고 관리) 기록 추가
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            group_id: referenceId, // shipmentId or serviceId
            type: isRevert ? 'in' : 'out', // 복구 시 입고, 차감 시 출고
            product_id: part.part_id,
            product_name: part.part_name,
            product_code: part.part_code,
            product_supplier: inferredBrandCode,
            quantity: Math.abs(quantityChange), // 항상 양수로 기록
            from_location: isRevert ? '외부(취소/환불)' : (part.warehouse_id || defaultWarehouseId),
            to_location: isRevert ? (part.warehouse_id || defaultWarehouseId) : '외부(고객)',
            date: format(new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"})), 'yyyy-MM-dd'),
            note: isRevert 
              ? `${referenceType === 'shipment' ? '[매장출고 취소]' : '[A/S 취소]'} 재고 복구 (Ref: ${refStr}${customerName ? `, ${customerName}` : ''})`
              : `${referenceType === 'shipment' ? '[매장출고 완료]' : '[A/S 완료]'} 재고 차감 (Ref: ${refStr}${customerName ? `, ${customerName}` : ''})`,
            is_grouped: true,
            status: '완료' // 확정 후 처리이므로 항상 완료
          });
          
        if (txError) {
          console.error('입출고 거래내역(transactions) 기록 실패:', txError);
        }

        results.push({
          part_id: part.part_id,
          part_name: part.part_name,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          changed_quantity: Math.abs(quantityChange),
          change_type: isRevert ? 'restored' : 'deducted',
          success: true,
          synced_parts_count: syncedParts.length
        });

      } catch (err) {
        errors.push(`부품 ${part.part_name} 처리 중 오류: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      total_processed: parts.length,
      successful_count: results.length,
      error_count: errors.length
    };

  } catch (err) {
    console.error('재고 차감 처리 중 오류:', err);
    return {
      success: false,
      results: [],
      errors: [err.message],
      total_processed: parts.length,
      successful_count: 0,
      error_count: parts.length
    };
  }
};

/**
 * 출고 완료 시 창고 재고 차감 (청담 등)
 */
export const processShipmentCompletion = async (shipmentId, brandCode) => {
  try {
    // const brandSettings = await getBrandSettings(brandCode);
    // if (!brandSettings.auto_inventory_deduction) {
    //   return { success: true, message: '자동 재고 차감 비활성화', skipped: true };
    // }

    // shipments에서 정보 확인
    const { data: shipment, error: shipErr } = await supabase
       .from('shipments')
       .select('status, customer_name, warehouse_id, shipment_id')
       .eq('id', shipmentId)
       .single();
    
    if (shipErr || !shipment) throw new Error('출고 정보를 찾을 수 없습니다.');
    
    // 출고 창고 설정
    let warehouseId = shipment.warehouse_id;
    if (!warehouseId) {
      // 지정된 창고가 없을 경우 기본 창고(청담)를 찾아 사용
      const { data: defaultWh } = await supabase
        .from('warehouses')
        .select('id')
        .ilike('name', '%청담%')
        .limit(1)
        .maybeSingle();
        
      if (defaultWh) {
        warehouseId = defaultWh.id;
      } else {
        // 청담 매장이 없으면 아무 창고나 첫번째 것을 사용
        const { data: anyWh } = await supabase.from('warehouses').select('id').limit(1).maybeSingle();
        if (anyWh) warehouseId = anyWh.id;
        else throw new Error('시스템에 등록된 창고가 없어 재고 차감이 불가능합니다.');
      }
    }

    const { data: shipmentParts, error } = await supabase
      .from('shipment_parts')
      .select('id, part_name, part_code, quantity, status, inventory_deducted')
      .eq('shipment_id', shipmentId);

    if (error) throw new Error(`출고 부품 조회 실패: ${error.message}`);
    if (!shipmentParts || shipmentParts.length === 0) return { success: true, message: '부품 없음', results: [] };

    let results = [];
    let hasError = false;

    for (const sp of shipmentParts) {
      if (!sp.inventory_deducted && sp.status !== '반품 완료') {
        // 아직 차감되지 않았고, 반품된 것도 아니라면 '준비 완료' 상태로 만들면서 차감
        const res = await updatePartStatus('shipment', shipmentId, sp.id, '준비 완료', brandCode);
        results.push(res);
        if (!res.success) hasError = true;
      }
    }

    if (hasError) {
      return { success: false, message: '일부 품목 차감 중 오류 발생', results };
    }

    return { success: true, message: '성공적으로 차감(또는 유지)되었습니다.', results };
  } catch (err) {
    return { success: false, message: `오류: ${err.message}`, errors: [err.message] };
  }
};

/**
 * 출고 상태 되돌림 시 창고 재고 복구
 */
export const processShipmentRevert = async (shipmentId, brandCode) => {
  return { success: true, message: '일괄 복구는 더 이상 지원되지 않습니다. 개별 품목 반품을 이용해 주세요.' };
};

/**
 * A/S 완료 시 창고 재고 차감
 */
export const processServiceCompletion = async (serviceId, brandCode) => {
  try {
    // const brandSettings = await getBrandSettings(brandCode);
    // if (!brandSettings.auto_inventory_deduction) return { success: true, skipped: true };

    const { data: service, error: srvErr } = await supabase.from('services').select('id, warehouse_id, customer_name, status').eq('id', serviceId).single();
    if (srvErr || !service) throw new Error('A/S를 찾을 수 없음: ' + (srvErr ? srvErr.message : 'no data'));
    let warehouseId = service.warehouse_id;
    if (!warehouseId) {
      const { data: defaultWh } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').limit(1).maybeSingle();
      if (defaultWh) {
        warehouseId = defaultWh.id;
      } else {
        const { data: anyWh } = await supabase.from('warehouses').select('id').limit(1).maybeSingle();
        if (anyWh) warehouseId = anyWh.id;
        else throw new Error('A/S 처리에 할당된 창고가 없습니다.');
      }
    }

    // --- DELTA SYNC LOGIC ---
    // 1. 기존 트랜잭션을 합산하여 이전에 차감된 잔여량 계산
    const { data: allTxs } = await supabase
      .from('transactions')
      .select('type, product_id, product_name, product_code, quantity, from_location, to_location')
      .eq('group_id', String(serviceId));
      
    const netDeductions = {};
    if (allTxs && allTxs.length > 0) {
      allTxs.forEach(tx => {
        const whId = tx.type === 'out' ? tx.from_location : tx.to_location;
        const key = `${tx.product_id}_${whId}`;
        if (!netDeductions[key]) {
          netDeductions[key] = { 
            part_id: tx.product_id, 
            part_name: tx.product_name, 
            part_code: tx.product_code, 
            warehouse_id: whId, 
            net_qty: 0 
          };
        }
        netDeductions[key].net_qty += (tx.type === 'out' ? tx.quantity : -tx.quantity);
      });
    }

    // 2. 현재 저장된 A/S 부품의 유효 필요 수량 계산
    const { data: serviceParts, error } = await supabase
      .from('service_parts')
      .select('part_id, quantity, usage, parts(name, code)')
      .eq('service_id', serviceId);

    if (error) throw new Error('A/S 부품 정보를 불러오지 못했습니다.');

    const effectiveParts = {};
    if (serviceParts && serviceParts.length > 0) {
      serviceParts.forEach(sp => {
        let returnedQty = 0;
        if (sp.usage && (sp.usage.includes('[반품완료]') || sp.usage.includes('워런티') || sp.usage.includes('Warranty'))) {
          returnedQty = sp.quantity;
        } else if (sp.usage) {
          const matches = sp.usage.match(/\[부분반품:(\d+)개\]/g);
          if (matches) {
            matches.forEach(m => {
              const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
              if (qtyMatch && qtyMatch[1]) {
                returnedQty += parseInt(qtyMatch[1], 10);
              }
            });
          }
        }
        
        const effectiveQty = Math.max(0, sp.quantity - returnedQty);
        
        if (effectiveQty > 0) {
          const key = `${sp.part_id}_${warehouseId}`;
          if (!effectiveParts[key]) {
            effectiveParts[key] = {
              part_id: sp.part_id,
              part_name: sp.parts?.name || 'Unknown',
              part_code: sp.parts?.code || 'Unknown',
              warehouse_id: warehouseId,
              effective_qty: 0
            };
          }
          effectiveParts[key].effective_qty += effectiveQty;
        }
      });
    }

    // 서비스 상태가 차감 대상이 아닌 경우(예: 준비중, 접수)에는 신규 차감을 하지 않음
    const deductStatuses = ['출고완료', '준비완료', '부품준비', '처리중'];
    if (!deductStatuses.includes(service.status)) {
      // 모든 effective_qty를 0으로 만들어서 차감 배열을 비움 (기존 차감분은 위 netDeductions에 의해 자동 원복됨)
      Object.keys(effectiveParts).forEach(key => {
        effectiveParts[key].effective_qty = 0;
      });
      console.log(`[A/S Inventory Sync] 상태가 '${service.status}'이므로 재고 차감 생략 (기존 차감 건이 있다면 자동 복구)`);
    }

    // 3. 기존 모든 차감 내역 완전 복구 (Revert All) 후 현재 상태로 신규 차감 (Re-Deduct)
    const partsToRevert = [];
    Object.keys(netDeductions).forEach(key => {
      const deducted = netDeductions[key].net_qty;
      if (deducted > 0) {
        partsToRevert.push({
          part_id: netDeductions[key].part_id,
          part_name: netDeductions[key].part_name,
          part_code: netDeductions[key].part_code,
          quantity: deducted,
          warehouse_id: netDeductions[key].warehouse_id
        });
      }
    });

    const partsToDeduct = [];
    Object.keys(effectiveParts).forEach(key => {
      const needed = effectiveParts[key].effective_qty;
      if (needed > 0) {
        partsToDeduct.push({
          part_id: effectiveParts[key].part_id,
          part_name: effectiveParts[key].part_name,
          part_code: effectiveParts[key].part_code,
          quantity: needed,
          warehouse_id: effectiveParts[key].warehouse_id
        });
      }
    });

    const results = [];
    
    if (partsToRevert.length > 0) {
      console.log(`[A/S Inventory Sync] 기존 차감량 완전 복구 (${partsToRevert.length}품목)`, partsToRevert);
      const revertResult = await processInventory(warehouseId, partsToRevert, brandCode, serviceId, 'service', 'service_revert', true, service.customer_name || '', String(serviceId));
      if (!revertResult.success) {
        console.error('재고 복구(Delta) 중 오류 발생:', revertResult);
        return revertResult;
      }
      results.push(...revertResult.results);
    }

    if (partsToDeduct.length > 0) {
      console.log(`[A/S Inventory Sync] 현재 필요 수량 전면 재차감 (${partsToDeduct.length}품목)`, partsToDeduct);
      const deductResult = await processInventory(warehouseId, partsToDeduct, brandCode, serviceId, 'service', 'service_complete', false, service.customer_name || '', String(serviceId));
      if (!deductResult.success) {
        console.error('재고 차감(Delta) 중 오류 발생:', deductResult);
        return deductResult;
      }
      results.push(...deductResult.results);
    }

    return { success: true, results };
  } catch (err) {
    return { success: false, message: `A/S 재고 동기화 실패: ${err.message}`, errors: [err.message] };
  }
};

/**
 * A/S 복구 시
 */
export const processServiceRevert = async (serviceId, brandCode) => {
  try {
    const { data: service, error: srvErr } = await supabase.from('services').select('id, warehouse_id').eq('id', serviceId).single();
    if (srvErr || !service) throw new Error('A/S를 찾을 수 없음: ' + (srvErr ? srvErr.message : 'no data'));

    let warehouseId = service.warehouse_id;
    if (!warehouseId) {
      const { data: defaultWh } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').limit(1).maybeSingle();
      if (defaultWh) {
        warehouseId = defaultWh.id;
      } else {
        const { data: anyWh } = await supabase.from('warehouses').select('id').limit(1).maybeSingle();
        if (anyWh) warehouseId = anyWh.id;
        else throw new Error('창고 미지정');
      }
    }

    const { data: serviceParts } = await supabase.from('service_parts').select('part_id, quantity, parts(name, code)').eq('service_id', serviceId);
    if (!serviceParts || serviceParts.length === 0) return { success: true, results: [] };

    const parts = serviceParts.map(sp => ({
      part_id: sp.part_id, part_name: sp.parts?.name || 'Unknown', part_code: sp.parts?.code || 'Unknown', quantity: sp.quantity
    }));

    const result = await processInventory(warehouseId, parts, brandCode, serviceId, 'service', 'service_revert', true, '', String(serviceId));
    return {
      ...result,
      message: result.success ? 'A/S 재고가 성공적으로 원상복구되었습니다.' : 'A/S 재고 복구 중 오류 발생.'
    };
  } catch (err) {
    return { success: false, message: err.message, errors: [err.message] };
  }
};
export const processPartialReturn = async (sourceType, orderId, recordId, quantity, brandCode) => {
  try {
    // const brandSettings = await getBrandSettings(brandCode);
    // if (!brandSettings.auto_inventory_deduction) return { success: true, skipped: true };

    let warehouseId = null;
    let displayRefId = '';
    if (sourceType === 'shipment') {
      const { data: shipment } = await supabase.from('shipments').select('warehouse_id, shipment_id').eq('id', orderId).single();
      warehouseId = shipment?.warehouse_id;
      displayRefId = shipment?.shipment_id || '';
    } else {
      const { data: service } = await supabase.from('services').select('warehouse_id, service_id').eq('id', orderId).single();
      warehouseId = service?.warehouse_id;
      displayRefId = service?.service_id || '';
    }
    if (!warehouseId) throw new Error('창고 정보 없음');

    const tableName = sourceType === 'shipment' ? 'shipment_parts' : 'service_parts';

    let partInfo;
    if (sourceType === 'shipment') {
      const { data, error } = await supabase.from(tableName).select('*').eq('id', recordId).single();
      if (error || !data) throw new Error('출고 부품을 찾을 수 없음');
      partInfo = data;
    } else {
      const { data, error } = await supabase.from(tableName).select('*, parts(name, code)').eq('id', recordId).single();
      if (error || !data) throw new Error('A/S 부품을 찾을 수 없음');
      partInfo = data;
    }

    let finalPartId = null;
    let finalCode = partInfo.parts?.code || partInfo.part_code || 'Unknown';
    let finalName = partInfo.parts?.name || partInfo.part_name || 'Unknown';

    if (sourceType === 'shipment') {
       if (partInfo.part_code) {
         const { data: searchRes } = await supabase.from('parts').select('id').eq('code', partInfo.part_code).limit(1).maybeSingle();
         if (searchRes) finalPartId = searchRes.id;
       }
       if (!finalPartId && partInfo.part_name) {
         const { data: searchRes2 } = await supabase.from('parts').select('id').eq('name', partInfo.part_name).limit(1).maybeSingle();
         if (searchRes2) finalPartId = searchRes2.id;
       }
    } else {
       finalPartId = partInfo.part_id;
    }

    if (!finalPartId) throw new Error('실제 재고 부품 ID를 찾을 수 없습니다.');

    let customerName = '';
    if (sourceType === 'shipment') {
      const { data: sData } = await supabase.from('shipments').select('customer_name').eq('id', orderId).maybeSingle();
      if (sData) customerName = sData.customer_name;
    } else {
      const { data: sData } = await supabase.from('services').select('customer_name').eq('id', orderId).maybeSingle();
      if (sData) customerName = sData.customer_name;
    }

    const result = await processInventory(
      warehouseId,
      [{ part_id: finalPartId, quantity: quantity, part_name: finalName, part_code: finalCode }],
      brandCode,
      orderId,
      sourceType,
      sourceType === 'shipment' ? 'shipment_cancel' : 'service_cancel',
      true, // isRevert = true -> 창고로 다시 입고(+)
      customerName || '',
      displayRefId
    );

    if (!result.success) throw new Error(result.message);

    const isPartial = quantity < partInfo.quantity;
    const noteSuffix = isPartial ? `[부분반품:${quantity}개]` : '[반품완료]';

    // 테이블 마킹
    if (sourceType === 'shipment') {
      const newNote = partInfo.note ? partInfo.note + ' ' + noteSuffix : noteSuffix;
      await supabase.from('shipment_parts').update({ note: newNote }).eq('id', recordId);
    } else {
      const newUsage = partInfo.usage ? partInfo.usage + ' ' + noteSuffix : noteSuffix;
      await supabase.from('service_parts').update({ usage: newUsage }).eq('id', recordId);
    }

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message, errors: [err.message] };
  }
};

/**
 * 개별 품목(Line-Item) 상태 변경 및 재고 연동 처리
 * @param {string} sourceType - 'shipment' | 'service'
 * @param {string} orderId - shipment.id 또는 service.id
 * @param {string} recordId - shipment_parts.id 또는 service_parts.id
 * @param {string} newStatus - '준비중', '부품 준비', '준비 완료', '반품 완료'
 * @param {string} brandCode - 브랜드 코드
 */
export const updatePartStatus = async (sourceType, orderId, recordId, newStatus, brandCode) => {
  try {
    const tableName = sourceType === 'shipment' ? 'shipment_parts' : 'service_parts';
    const parentTableName = sourceType === 'shipment' ? 'shipments' : 'services';
    const parentIdColumn = sourceType === 'shipment' ? 'shipment_id' : 'service_id';

    // 1. 현재 부품 정보 조회
    let partQuery = supabase.from(tableName).select('*').eq('id', recordId).single();
    if (sourceType === 'service') {
      partQuery = supabase.from(tableName).select('*, parts(name, code)').eq('id', recordId).single();
    }
    const { data: partInfo, error: partErr } = await partQuery;
    if (partErr || !partInfo) throw new Error('부품 정보를 찾을 수 없습니다.');

    // 2. 부모 정보(창고, 고객명, 표시번호) 조회
    const { data: parentInfo, error: parentErr } = await supabase
      .from(parentTableName)
      .select(`warehouse_id, customer_name, ${parentIdColumn}`)
      .eq('id', orderId)
      .single();
    if (parentErr || !parentInfo) throw new Error('주문 정보를 찾을 수 없습니다.');

    let warehouseId = parentInfo.warehouse_id;
    if (!warehouseId) {
      const { data: defaultWh } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').limit(1).maybeSingle();
      warehouseId = defaultWh ? defaultWh.id : null;
      if (!warehouseId) {
        const { data: anyWh } = await supabase.from('warehouses').select('id').limit(1).maybeSingle();
        warehouseId = anyWh ? anyWh.id : null;
      }
      if (!warehouseId) throw new Error('창고 정보 없음');
    }

    const currentStatus = partInfo.status || '준비중';
    const isCurrentlyDeducted = partInfo.inventory_deducted || false;
    
    // 상태 변경으로 인한 재고 액션 판별
    const needsDeduction = (newStatus === '부품 준비' || newStatus === '준비 완료');
    const needsRevert = (newStatus === '반품 완료');
    const isReset = (newStatus === '준비중');

    let inventoryAction = null; // 'deduct' | 'revert' | null

    if (!isCurrentlyDeducted && needsDeduction) {
      inventoryAction = 'deduct';
    } else if (isCurrentlyDeducted && (needsRevert || isReset)) {
      inventoryAction = 'revert';
    } else if (!isCurrentlyDeducted && needsRevert) {
      // 차감된 적 없는데 반품 완료로 변경? 재고 액션 없음, 상태만 업데이트
      inventoryAction = null;
    }

    let finalPartId = null;
    let finalCode = partInfo.part_code || (partInfo.parts && partInfo.parts.code) || 'Unknown';
    let finalName = partInfo.part_name || (partInfo.parts && partInfo.parts.name) || 'Unknown';

    if (sourceType === 'shipment') {
       if (partInfo.part_code) {
         const { data: searchRes } = await supabase.from('parts').select('id').eq('code', partInfo.part_code).limit(1).maybeSingle();
         if (searchRes) finalPartId = searchRes.id;
       }
       if (!finalPartId && partInfo.part_name) {
         const { data: searchRes2 } = await supabase.from('parts').select('id').eq('name', partInfo.part_name).limit(1).maybeSingle();
         if (searchRes2) finalPartId = searchRes2.id;
       }
    } else {
       finalPartId = partInfo.part_id;
    }

    if (inventoryAction && !finalPartId && finalName !== 'Unknown') {
      // ID를 못찾았지만 단순 텍스트 기록용이라면 그냥 통과 (processInventory가 처리함)
    } else if (inventoryAction && !finalPartId) {
      throw new Error('재고 차감/복구를 위한 부품 ID를 찾을 수 없습니다.');
    }

    // 3. 재고 처리
    if (inventoryAction) {
      const isRevertAction = inventoryAction === 'revert';
      const changeTypeStr = sourceType === 'shipment' 
        ? (isRevertAction ? 'shipment_cancel' : 'shipment_complete')
        : (isRevertAction ? 'service_cancel' : 'service_complete');

      const result = await processInventory(
        warehouseId,
        [{ part_id: finalPartId, quantity: partInfo.quantity, part_name: finalName, part_code: finalCode }],
        brandCode,
        orderId,
        sourceType,
        changeTypeStr,
        isRevertAction,
        parentInfo.customer_name || '',
        parentInfo[parentIdColumn] || ''
      );

      if (!result.success) {
        throw new Error(`재고 처리 오류: ${result.message}`);
      }
    }

    // 4. DB 업데이트
    const newDeducted = needsDeduction ? true : (needsRevert || isReset ? false : isCurrentlyDeducted);
    const { error: updateErr } = await supabase
      .from(tableName)
      .update({ 
        status: newStatus,
        inventory_deducted: newDeducted
      })
      .eq('id', recordId);

    if (updateErr) throw new Error(`상태 업데이트 실패: ${updateErr.message}`);

    return { success: true, message: '상태가 변경되었습니다.', inventoryAction };

  } catch (err) {
    console.error('updatePartStatus error:', err);
    return { success: false, message: err.message };
  }
};

