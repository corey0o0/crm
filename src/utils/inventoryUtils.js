import { supabase } from '../lib/supabaseClient';
import { getSyncedParts } from './partSyncUtils';

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
export const processInventory = async (defaultWarehouseId, parts, brandCode, referenceId, referenceType, changeType, isRevert = false) => {
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
      if (!part.part_id) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(referenceId));
        const txGroupId = isUUID ? null : parseInt(referenceId, 10);
        
        const quantityChange = isRevert ? part.quantity : -part.quantity;
        // 트랜잭션만 기록
        const { error: txError } = await supabase.from('transactions').insert({
          group_id: isNaN(txGroupId) ? null : txGroupId,
          type: isRevert ? 'in' : 'out',
          product_id: null,
          product_name: part.part_name,
          product_code: part.part_code,
          product_supplier: brandCode || 'NEARBIKE',
          quantity: Math.abs(quantityChange),
          from_location: isRevert ? '외부(취소/환불)' : (part.warehouse_id || defaultWarehouseId),
          to_location: isRevert ? (part.warehouse_id || defaultWarehouseId) : '외부(고객)',
          date: new Date().toISOString().split('T')[0],
          note: isRevert 
            ? `${referenceType === 'shipment' ? '[매장출고 취소]' : '[A/S 취소]'} 단순 기록 (Ref: ${referenceId})`
            : `${referenceType === 'shipment' ? '[매장출고 완료]' : '[A/S 완료]'} 단순 기록 (Ref: ${referenceId})`,
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
        const { data: currentInv, error: stockGrpError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('warehouse_id', part.warehouse_id || defaultWarehouseId)
          .eq('product_id', part.part_id)
          .maybeSingle();

        if (stockGrpError && stockGrpError.code !== 'PGRST116') {
          console.error(`[Inventory] 재고 조회 에러 (부품: ${part.part_name}):`, stockGrpError);
        }

        const previousQuantity = currentInv ? currentInv.quantity : 0;
        const quantityChange = isRevert ? part.quantity : -part.quantity;
        const newQuantity = previousQuantity + quantityChange; // 0 아래로 떨어질 수 있도록 제한 해제

        // 연동된 파츠 조회
        const syncedParts = await getSyncedParts(part.part_id);
        const allPartIds = [part.part_id, ...syncedParts.map(sp => sp.part.id)];

        // 모든 파츠(기본 + 연동) 재고 업데이트 (inventory 테이블)
        const updatePromises = allPartIds.map(async (pId) => {
           // 먼저 해당 아이템의 기존 재고 조회
           const { data: pInv } = await supabase
             .from('inventory')
             .select('quantity')
             .eq('warehouse_id', part.warehouse_id || defaultWarehouseId)
             .eq('product_id', pId)
             .maybeSingle();
           
           const pPrev = pInv ? pInv.quantity : 0;
           const pNew = pPrev + quantityChange;

           return supabase.from('inventory').upsert({
             warehouse_id: part.warehouse_id || defaultWarehouseId,
             product_id: pId,
             quantity: pNew,
             updated_at: new Date().toISOString()
           }, { onConflict: 'warehouse_id,product_id' });
        });

        const updateResults = await Promise.all(updatePromises);
        const updateErrors = updateResults.filter(r => r.error);

        if (updateErrors.length > 0) {
          const errorMessages = updateErrors.map(e => e.error.message).join(', ');
          errors.push(`부품 ${part.part_name} 및 연동 파츠 재고 업데이트 실패: ${errorMessages}`);
          continue;
        }

        // 재고 로그 기록
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert({
            part_id: null, // 외래키/타입(uuid) 충돌 방지를 위해 임시 null 처리 (향후 DB 타입 변경 필요)
            part_name: part.part_name,
            part_code: part.part_code,
            brand_code: brandCode,
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
            product_supplier: brandCode || 'NEARBIKE',
            quantity: Math.abs(quantityChange), // 항상 양수로 기록
            from_location: isRevert ? '외부(취소/환불)' : (part.warehouse_id || defaultWarehouseId),
            to_location: isRevert ? (part.warehouse_id || defaultWarehouseId) : '외부(고객)',
            date: new Date().toISOString().split('T')[0],
            note: isRevert 
              ? `${referenceType === 'shipment' ? '[매장출고 취소]' : '[A/S 취소]'} 재고 복구 (Ref: ${referenceId})`
              : `${referenceType === 'shipment' ? '[매장출고 완료]' : '[A/S 완료]'} 재고 차감 (Ref: ${referenceId})`,
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
       .select('status, customer_name')
       .eq('id', shipmentId)
       .single();
    
    if (shipErr || !shipment) throw new Error('출고 정보를 찾을 수 없습니다.');
    
    // 기본 창고(청담) 설정
    const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').maybeSingle();
    const warehouseId = fw ? fw.id : null;
    if (!warehouseId) throw new Error('출고에 지정할 기준 창고(청담) 정보를 찾을 수 없습니다.');

    const { data: shipmentParts, error } = await supabase
      .from('shipment_parts')
      .select('part_name, part_code, quantity, part_category')
      .eq('shipment_id', shipmentId);

    if (error) throw new Error(`출고 부품 조회 실패: ${error.message}`);
    if (!shipmentParts || shipmentParts.length === 0) return { success: true, message: '부품 없음', results: [] };

    // part_id 매칭 처리
    const parts = [];
    for (const sp of shipmentParts) {
      let foundParts = null;
      let partError = null;

      if (sp.part_code) {
        const { data, error } = await supabase.from('parts').select('id, name, code').eq('code', sp.part_code).limit(1);
        foundParts = data;
        partError = error;
      }
      if ((!foundParts || foundParts.length === 0) && sp.part_name) {
        const { data, error } = await supabase.from('parts').select('id, name, code').eq('name', sp.part_name).limit(1);
        foundParts = data;
        partError = error;
      }

      if (!partError && foundParts && foundParts.length > 0) {
        parts.push({
          part_id: foundParts[0].id,
          part_name: sp.part_name,
          part_code: sp.part_code,
          quantity: sp.quantity,
          warehouse_id: warehouseId
        });
      } else {
        parts.push({
          part_id: null,
          part_name: sp.part_name,
          part_code: sp.part_code,
          quantity: sp.quantity,
          warehouse_id: warehouseId
        });
      }
    }

    if (parts.length === 0) {
      return { success: false, message: 'parts 매칭 부품 없음', results: [] };
    }

    // 재고 차감 실행
    const result = await processInventory(
      warehouseId,
      parts,
      brandCode,
      shipmentId,
      'shipment',
      'shipment_complete',
      false // 차감
    );

    return {
      ...result,
      message: result.success ? `성공적으로 차감되었습니다.` : `차감 중 오류 발생.`
    };
  } catch (err) {
    return { success: false, message: `오류: ${err.message}`, errors: [err.message] };
  }
};

/**
 * 출고 상태 되돌림 시 창고 재고 복구
 */
export const processShipmentRevert = async (shipmentId, brandCode) => {
  try {
    // const brandSettings = await getBrandSettings(brandCode);
    // if (!brandSettings.auto_inventory_deduction) return { success: true, skipped: true };

    const { data: shipment, error: shipErr } = await supabase
       .from('shipments')
       .select('id')
       .eq('id', shipmentId)
       .single();
    if (shipErr || !shipment) throw new Error('출고 정보 없음');

    const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').maybeSingle();
    const warehouseId = fw ? fw.id : null;
    if (!warehouseId) throw new Error('기본 창고 정보 없음');

    const { data: shipmentParts } = await supabase.from('shipment_parts').select('part_name, part_code, quantity').eq('shipment_id', shipmentId);
    if (!shipmentParts || shipmentParts.length === 0) return { success: true, results: [] };

    const parts = [];
    for (const sp of shipmentParts) {
      let foundParts = null;
      if (sp.part_code) foundParts = (await supabase.from('parts').select('id').eq('code', sp.part_code).limit(1)).data;
      if ((!foundParts || foundParts.length === 0) && sp.part_name) foundParts = (await supabase.from('parts').select('id').eq('name', sp.part_name).limit(1)).data;
      
      if (foundParts && foundParts.length > 0) {
        parts.push({ part_id: foundParts[0].id, part_name: sp.part_name, part_code: sp.part_code, quantity: sp.quantity, warehouse_id: warehouseId });
      } else {
        parts.push({ part_id: null, part_name: sp.part_name, part_code: sp.part_code, quantity: sp.quantity, warehouse_id: warehouseId });
      }
    }
    
    if (parts.length === 0) return { success: false, message: '부품 매칭 실패' };

    const result = await processInventory(warehouseId, parts, brandCode, shipmentId, 'shipment', 'shipment_revert', true);
    return result;
  } catch (err) {
    return { success: false, message: `오류: ${err.message}`, errors: [err.message] };
  }
};

/**
 * A/S 완료 시 창고 재고 차감
 */
export const processServiceCompletion = async (serviceId, brandCode) => {
  try {
    // const brandSettings = await getBrandSettings(brandCode);
    // if (!brandSettings.auto_inventory_deduction) return { success: true, skipped: true };

    
    const { data: service, error: srvErr } = await supabase.from('services').select('id').eq('id', serviceId).single();
    if (srvErr || !service) throw new Error('A/S를 찾을 수 없음');
    
    // A/S에 창고 정보가 없으므로 기본(청담) 창고 할당
    let warehouseId = null;
    if (!warehouseId) {
      const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').maybeSingle();
      warehouseId = fw ? fw.id : null;
      if(!warehouseId) throw new Error('A/S 처리에 할당된 창고가 없습니다.');
    }

    // --- ROLLBACK LOGIC ---
    // 기존 트랜잭션을 합산하여 이전에 차감된 잔여량이 있다면 우선 복구 진행
    const { data: allTxs } = await supabase
      .from('transactions')
      .select('type, product_id, product_name, product_code, quantity, from_location, to_location')
      .eq('group_id', String(serviceId));
      
    if (allTxs && allTxs.length > 0) {
      const netDeductions = {};
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
      
      const revertParts = Object.values(netDeductions)
        .filter(tx => tx.net_qty > 0)
        .map(tx => ({
          part_id: tx.part_id,
          part_name: tx.part_name,
          part_code: tx.part_code,
          quantity: tx.net_qty,
          warehouse_id: tx.warehouse_id
        }));

      if (revertParts.length > 0) {
        console.log(`[A/S Rollback] 기존 차감 잔액 복구 시작 (${revertParts.length}품목)`);
        const revertResult = await processInventory(warehouseId, revertParts, brandCode, serviceId, 'service', 'service_revert', true);
        if (!revertResult.success) {
           console.error('기존 재고 롤백 중 오류 발생:', revertResult);
        }
      }
    }
    // --- END ROLLBACK LOGIC ---


    const { data: serviceParts, error } = await supabase.from('service_parts').select('part_id, quantity, parts(name, code)').eq('service_id', serviceId);
    if (error || !serviceParts || serviceParts.length === 0) return { success: true, results: [] };

    const parts = serviceParts.map(sp => ({
      part_id: sp.part_id, part_name: sp.parts?.name || 'Unknown', part_code: sp.parts?.code || 'Unknown', quantity: sp.quantity, warehouse_id: warehouseId
    }));

    const result = await processInventory(warehouseId, parts, brandCode, serviceId, 'service', 'service_complete', false);
    return result;
  } catch (err) {
    return { success: false, message: `A/S 재고 차감 실패: ${err.message}`, errors: [err.message] };
  }
};

/**
 * A/S 복구 시
 */
export const processServiceRevert = async (serviceId, brandCode) => {
  try {
    // const brandSettings = await getBrandSettings(brandCode);
    // if (!brandSettings.auto_inventory_deduction) return { success: true, skipped: true };

    await supabase.from('services').select('id').eq('id', serviceId).single(); // validate existence
    let warehouseId = null;
    if (!warehouseId) {
       const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').maybeSingle();
       warehouseId = fw ? fw.id : null;
       if(!warehouseId) throw new Error('창고 미지정');
    }

    const { data: serviceParts } = await supabase.from('service_parts').select('part_id, quantity, parts(name, code)').eq('service_id', serviceId);
    if (!serviceParts || serviceParts.length === 0) return { success: true, results: [] };

    const parts = serviceParts.map(sp => ({
      part_id: sp.part_id, part_name: sp.parts?.name || 'Unknown', part_code: sp.parts?.code || 'Unknown', quantity: sp.quantity
    }));

    const result = await processInventory(warehouseId, parts, brandCode, serviceId, 'service', 'service_revert', true);
    return result;
  } catch (err) {
    return { success: false, message: err.message, errors: [err.message] };
  }
};
export const processPartialReturn = async (sourceType, orderId, recordId, quantity, brandCode) => {
  try {
    // const brandSettings = await getBrandSettings(brandCode);
    // if (!brandSettings.auto_inventory_deduction) return { success: true, skipped: true };

    const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').maybeSingle();
    const warehouseId = fw ? fw.id : null;
    if (!warehouseId) throw new Error('기본 창고 정보 없음');

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

    const result = await processInventory(
      warehouseId,
      [{ part_id: finalPartId, quantity: quantity, part_name: finalName, part_code: finalCode }],
      brandCode,
      orderId,
      sourceType,
      sourceType === 'shipment' ? 'shipment_cancel' : 'service_cancel',
      true // isRevert = true -> 창고로 다시 입고(+)
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
