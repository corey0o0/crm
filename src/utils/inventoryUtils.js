import { supabase } from '../lib/supabaseClient';
import { getSyncedParts } from './partSyncUtils';

/**
 * 브랜드 설정 조회
 * @param {string} brandCode - 브랜드 코드 (XRB, NB)
 * @returns {Object} 브랜드 설정 정보
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
 * 재고 증감 처리 (차감 또는 복구)
 * @param {Array} parts - 처리할 부품 목록 [{ part_id, part_name, part_code, quantity }]
 * @param {string} brandCode - 브랜드 코드
 * @param {string} referenceId - 참조 ID (shipment_id 또는 service_id)
 * @param {string} referenceType - 참조 타입 ('shipment' 또는 'service')
 * @param {string} changeType - 변경 타입 ('shipment_complete', 'service_complete', 'shipment_revert', 'service_revert')
 * @param {boolean} isRevert - 복구 여부 (true: 재고 증가, false: 재고 차감)
 * @returns {Object} 처리 결과
 */
export const processInventory = async (parts, brandCode, referenceId, referenceType, changeType, isRevert = false) => {
  try {
    const results = [];
    const errors = [];

    for (const part of parts) {
      try {
        // 현재 재고 조회
        const { data: currentStock, error: stockError } = await supabase
          .from('parts')
          .select('id, name, code, stock')
          .eq('id', part.part_id)
          .single();

        if (stockError) {
          errors.push(`부품 ${part.part_name} 재고 조회 실패: ${stockError.message}`);
          continue;
        }

        const previousQuantity = currentStock.stock || 0;
        const quantityChange = isRevert ? part.quantity : -part.quantity;
        const newQuantity = Math.max(0, previousQuantity + quantityChange);

        // 연동된 파츠 목록 조회
        const syncedParts = await getSyncedParts(part.part_id);
        const allPartIds = [part.part_id, ...syncedParts.map(sp => sp.part.id)];

        // 연동된 모든 파츠의 재고 조회
        const { data: allPartsData, error: allPartsError } = await supabase
          .from('parts')
          .select('id, name, code, stock')
          .in('id', allPartIds);

        if (allPartsError) {
          console.warn('연동 파츠 재고 조회 실패:', allPartsError);
          // 연동 파츠 조회 실패해도 기본 파츠는 처리 계속
        }

        // 모든 파츠(기본 + 연동)의 재고 업데이트
        const updatePromises = (allPartsData || [currentStock]).map(p => {
          const partPreviousQuantity = p.stock || 0;
          const partNewQuantity = Math.max(0, partPreviousQuantity + quantityChange);
          
          return supabase
            .from('parts')
            .update({ 
              stock: partNewQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', p.id);
        });

        const updateResults = await Promise.all(updatePromises);
        const updateErrors = updateResults.filter(r => r.error);

        if (updateErrors.length > 0) {
          const errorMessages = updateErrors.map(e => e.error.message).join(', ');
          errors.push(`부품 ${part.part_name} 및 연동 파츠 재고 업데이트 실패: ${errorMessages}`);
          continue;
        }

        // 재고 로그 기록 (기본 파츠만 기록)
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert({
            part_id: null, // 외래키 제약조건 문제를 피하기 위해 null로 설정
            part_name: part.part_name,
            part_code: part.part_code || currentStock.code,
            brand_code: brandCode,
            change_type: changeType,
            quantity_change: quantityChange,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity,
            reference_id: referenceId,
            reference_type: referenceType,
            notes: isRevert 
              ? `${referenceType === 'shipment' ? '출고' : 'A/S'} 상태 되돌림으로 인한 재고 복구${syncedParts.length > 0 ? ` (연동 파츠 ${syncedParts.length}개 포함)` : ''}`
              : `${referenceType === 'shipment' ? '출고' : 'A/S'} 완료로 인한 자동 차감${syncedParts.length > 0 ? ` (연동 파츠 ${syncedParts.length}개 포함)` : ''}`
          });

        if (logError) {
          console.error('재고 로그 기록 실패:', logError);
          // 로그 기록 실패해도 처리는 계속 진행
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
 * 출고 완료 시 재고 차감
 * @param {string} shipmentId - 출고 ID
 * @param {string} brandCode - 브랜드 코드
 * @returns {Object} 처리 결과
 */
export const processShipmentCompletion = async (shipmentId, brandCode) => {
  try {
    // 브랜드 설정 확인
    const brandSettings = await getBrandSettings(brandCode);
    if (!brandSettings.auto_inventory_deduction) {
      return {
        success: true,
        message: '해당 브랜드는 자동 재고 차감이 비활성화되어 있습니다.',
        skipped: true
      };
    }

    // 출고 부품 목록 조회
    const { data: shipmentParts, error } = await supabase
      .from('shipment_parts')
      .select(`
        part_name,
        part_code,
        quantity
      `)
      .eq('shipment_id', shipmentId);

    if (error) {
      throw new Error(`출고 부품 조회 실패: ${error.message}`);
    }

    if (!shipmentParts || shipmentParts.length === 0) {
      return {
        success: true,
        message: '차감할 부품이 없습니다.',
        results: []
      };
    }

    // parts 테이블에서 해당 부품들의 실제 ID를 찾기
    const parts = [];
    for (const sp of shipmentParts) {
      let foundParts = null;
      let partError = null;

      // 먼저 part_code로 검색
      if (sp.part_code) {
        const { data, error } = await supabase
          .from('parts')
          .select('id, name, code, stock')
          .eq('code', sp.part_code)
          .limit(1);
        
        foundParts = data;
        partError = error;
      }

      // part_code로 못 찾으면 part_name으로 검색
      if ((!foundParts || foundParts.length === 0) && sp.part_name) {
        const { data, error } = await supabase
          .from('parts')
          .select('id, name, code, stock')
          .eq('name', sp.part_name)
          .limit(1);
        
        foundParts = data;
        partError = error;
      }

      if (!partError && foundParts && foundParts.length > 0) {
        parts.push({
          part_id: foundParts[0].id,
          part_name: sp.part_name,
          part_code: sp.part_code,
          quantity: sp.quantity
        });
      } else {
        console.warn(`부품을 찾을 수 없습니다: ${sp.part_name} (${sp.part_code})`);
      }
    }

    if (parts.length === 0) {
      return {
        success: false,
        message: 'parts 테이블에서 매칭되는 부품을 찾을 수 없습니다.',
        results: [],
        total_processed: shipmentParts.length,
        successful_count: 0,
        error_count: shipmentParts.length
      };
    }

    // 재고 차감 실행
    const result = await processInventory(
      parts,
      brandCode,
      shipmentId,
      'shipment',
      'shipment_complete',
      false // 차감
    );

    const notFoundCount = shipmentParts.length - parts.length;
    return {
      ...result,
      message: result.success 
        ? `${result.successful_count}개 부품의 재고가 성공적으로 차감되었습니다.${notFoundCount > 0 ? ` (${notFoundCount}개 부품을 parts 테이블에서 찾을 수 없음)` : ''}`
        : `재고 차감 중 오류가 발생했습니다. ${result.error_count}개 부품에서 오류 발생.${notFoundCount > 0 ? ` (${notFoundCount}개 부품을 parts 테이블에서 찾을 수 없음)` : ''}`
    };

  } catch (err) {
    console.error('출고 완료 처리 중 오류:', err);
    return {
      success: false,
      message: `출고 완료 처리 실패: ${err.message}`,
      errors: [err.message]
    };
  }
};

/**
 * 출고 상태 되돌림 시 재고 복구
 * @param {string} shipmentId - 출고 ID
 * @param {string} brandCode - 브랜드 코드
 * @returns {Object} 처리 결과
 */
export const processShipmentRevert = async (shipmentId, brandCode) => {
  try {
    // 브랜드 설정 확인
    const brandSettings = await getBrandSettings(brandCode);
    if (!brandSettings.auto_inventory_deduction) {
      return {
        success: true,
        message: '해당 브랜드는 자동 재고 차감이 비활성화되어 있어 복구할 필요가 없습니다.',
        skipped: true
      };
    }

    // 출고 부품 목록 조회
    const { data: shipmentParts, error } = await supabase
      .from('shipment_parts')
      .select(`
        part_name,
        part_code,
        quantity
      `)
      .eq('shipment_id', shipmentId);

    if (error) {
      throw new Error(`출고 부품 조회 실패: ${error.message}`);
    }

    if (!shipmentParts || shipmentParts.length === 0) {
      return {
        success: true,
        message: '복구할 부품이 없습니다.',
        results: []
      };
    }

    // parts 테이블에서 해당 부품들의 실제 ID를 찾기
    const parts = [];
    for (const sp of shipmentParts) {
      let foundParts = null;
      let partError = null;

      // 먼저 part_code로 검색
      if (sp.part_code) {
        const { data, error } = await supabase
          .from('parts')
          .select('id, name, code, stock')
          .eq('code', sp.part_code)
          .limit(1);
        
        foundParts = data;
        partError = error;
      }

      // part_code로 못 찾으면 part_name으로 검색
      if ((!foundParts || foundParts.length === 0) && sp.part_name) {
        const { data, error } = await supabase
          .from('parts')
          .select('id, name, code, stock')
          .eq('name', sp.part_name)
          .limit(1);
        
        foundParts = data;
        partError = error;
      }

      if (!partError && foundParts && foundParts.length > 0) {
        parts.push({
          part_id: foundParts[0].id,
          part_name: sp.part_name,
          part_code: sp.part_code,
          quantity: sp.quantity
        });
      } else {
        console.warn(`부품을 찾을 수 없습니다: ${sp.part_name} (${sp.part_code})`);
      }
    }

    if (parts.length === 0) {
      return {
        success: false,
        message: 'parts 테이블에서 매칭되는 부품을 찾을 수 없습니다.',
        results: [],
        total_processed: shipmentParts.length,
        successful_count: 0,
        error_count: shipmentParts.length
      };
    }

    // 재고 복구 실행
    const result = await processInventory(
      parts,
      brandCode,
      shipmentId,
      'shipment',
      'shipment_revert',
      true // 복구
    );

    const notFoundCount = shipmentParts.length - parts.length;
    return {
      ...result,
      message: result.success 
        ? `${result.successful_count}개 부품의 재고가 성공적으로 복구되었습니다.${notFoundCount > 0 ? ` (${notFoundCount}개 부품을 parts 테이블에서 찾을 수 없음)` : ''}`
        : `재고 복구 중 오류가 발생했습니다. ${result.error_count}개 부품에서 오류 발생.${notFoundCount > 0 ? ` (${notFoundCount}개 부품을 parts 테이블에서 찾을 수 없음)` : ''}`
    };

  } catch (err) {
    console.error('출고 상태 복구 처리 중 오류:', err);
    return {
      success: false,
      message: `출고 상태 복구 처리 실패: ${err.message}`,
      errors: [err.message]
    };
  }
};

/**
 * A/S 완료 시 재고 차감
 * @param {string} serviceId - 서비스 ID
 * @param {string} brandCode - 브랜드 코드
 * @returns {Object} 처리 결과
 */
export const processServiceCompletion = async (serviceId, brandCode) => {
  try {
    // 브랜드 설정 확인
    const brandSettings = await getBrandSettings(brandCode);
    if (!brandSettings.auto_inventory_deduction) {
      return {
        success: true,
        message: '해당 브랜드는 자동 재고 차감이 비활성화되어 있습니다.',
        skipped: true
      };
    }

    // 서비스 부품 목록 조회
    const { data: serviceParts, error } = await supabase
      .from('service_parts')
      .select(`
        part_id,
        quantity,
        parts (
          name,
          code
        )
      `)
      .eq('service_id', serviceId);

    if (error) {
      throw new Error(`서비스 부품 조회 실패: ${error.message}`);
    }

    if (!serviceParts || serviceParts.length === 0) {
      return {
        success: true,
        message: '차감할 부품이 없습니다.',
        results: []
      };
    }

    // 부품 정보 변환
    const parts = serviceParts.map(sp => ({
      part_id: sp.part_id,
      part_name: sp.parts?.name || 'Unknown',
      part_code: sp.parts?.code || 'Unknown',
      quantity: sp.quantity
    }));

    // 재고 차감 실행
    const result = await processInventory(
      parts,
      brandCode,
      serviceId,
      'service',
      'service_complete',
      false // 차감
    );

    return {
      ...result,
      message: result.success 
        ? `${result.successful_count}개 부품의 재고가 성공적으로 차감되었습니다.`
        : `재고 차감 중 오류가 발생했습니다. ${result.error_count}개 부품에서 오류 발생.`
    };

  } catch (err) {
    console.error('A/S 완료 처리 중 오류:', err);
    return {
      success: false,
      message: `A/S 완료 처리 실패: ${err.message}`,
      errors: [err.message]
    };
  }
};

/**
 * A/S 상태 되돌림 시 재고 복구
 * @param {string} serviceId - 서비스 ID
 * @param {string} brandCode - 브랜드 코드
 * @returns {Object} 처리 결과
 */
export const processServiceRevert = async (serviceId, brandCode) => {
  try {
    // 브랜드 설정 확인
    const brandSettings = await getBrandSettings(brandCode);
    if (!brandSettings.auto_inventory_deduction) {
      return {
        success: true,
        message: '해당 브랜드는 자동 재고 차감이 비활성화되어 있어 복구할 필요가 없습니다.',
        skipped: true
      };
    }

    // 서비스 부품 목록 조회
    const { data: serviceParts, error } = await supabase
      .from('service_parts')
      .select(`
        part_id,
        quantity,
        parts (
          name,
          code
        )
      `)
      .eq('service_id', serviceId);

    if (error) {
      throw new Error(`서비스 부품 조회 실패: ${error.message}`);
    }

    if (!serviceParts || serviceParts.length === 0) {
      return {
        success: true,
        message: '복구할 부품이 없습니다.',
        results: []
      };
    }

    // 부품 정보를 변환
    const parts = serviceParts.map(sp => ({
      part_id: sp.part_id,
      part_name: sp.parts?.name || 'Unknown',
      part_code: sp.parts?.code || 'Unknown',
      quantity: sp.quantity
    }));

    // 재고 복구 실행
    const result = await processInventory(
      parts,
      brandCode,
      serviceId,
      'service',
      'service_revert',
      true // 복구
    );

    return {
      ...result,
      message: result.success 
        ? `${result.successful_count}개 부품의 재고가 성공적으로 복구되었습니다.`
        : `재고 복구 중 오류가 발생했습니다. ${result.error_count}개 부품에서 오류 발생.`
    };

  } catch (err) {
    console.error('A/S 상태 복구 처리 중 오류:', err);
    return {
      success: false,
      message: `A/S 상태 복구 처리 실패: ${err.message}`,
      errors: [err.message]
    };
  }
};