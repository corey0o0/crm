import { supabase } from '../lib/supabaseClient';

/**
 * 주문대기 생성
 * @param {string} referenceType - 참조 타입 ('service' | 'shipment')
 * @param {number} referenceId - 참조 ID (service_id 또는 shipment_id)
 * @param {string} brand - 브랜드 코드 ('XRB' | 'NB')
 * @param {Array} items - 주문대기 상품 목록 [{ part_id, part_name, part_code, barcode, quantity }]
 * @returns {Object} 생성된 주문대기 정보
 */
export const createPendingOrder = async (referenceType, referenceId, brand, items) => {
  try {
    if (!items || items.length === 0) {
      return {
        success: false,
        message: '주문대기 상품이 없습니다.',
        data: null
      };
    }

    // 주문대기 그룹 생성
    const { data: pendingOrder, error: orderError } = await supabase
      .from('pending_orders')
      .insert({
        reference_type: referenceType,
        reference_id: referenceId,
        brand: brand,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`주문대기 생성 실패: ${orderError.message}`);
    }

    // 주문대기 상품 목록 생성
    const orderItems = items.map(item => ({
      pending_order_id: pendingOrder.id,
      part_id: item.part_id || null,
      part_name: item.part_name,
      part_code: item.part_code || null,
      barcode: item.barcode || null,
      quantity: item.quantity || 1,
      status: 'pending',
      options: item.options || {}
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('pending_order_items')
      .insert(orderItems)
      .select();

    if (itemsError) {
      // 주문대기 그룹 삭제 (롤백)
      await supabase
        .from('pending_orders')
        .delete()
        .eq('id', pendingOrder.id);
      
      throw new Error(`주문대기 상품 추가 실패: ${itemsError.message}`);
    }

    return {
      success: true,
      message: `${items.length}개 상품이 주문대기 목록에 추가되었습니다.`,
      data: {
        pendingOrder,
        items: insertedItems
      }
    };

  } catch (err) {
    console.error('주문대기 생성 중 오류:', err);
    return {
      success: false,
      message: err.message,
      data: null
    };
  }
};

/**
 * A/S 완료 시 주문대기 추가
 * @param {number} serviceId - 서비스 ID
 * @param {string} brandCode - 브랜드 코드
 * @returns {Object} 처리 결과
 */
export const addServicePartsToPendingOrders = async (serviceId, brandCode) => {
  try {
    // 서비스 부품 목록 조회
    const { data: serviceParts, error } = await supabase
      .from('service_parts')
      .select(`
        part_id,
        quantity,
        parts (
          name,
          code,
          barcode
        )
      `)
      .eq('service_id', serviceId);

    if (error) {
      throw new Error(`서비스 부품 조회 실패: ${error.message}`);
    }

    if (!serviceParts || serviceParts.length === 0) {
      return {
        success: true,
        message: '주문대기할 부품이 없습니다.',
        skipped: true
      };
    }

    // 부품 정보 변환
    const items = serviceParts.map(sp => ({
      part_id: sp.part_id,
      part_name: sp.parts?.name || 'Unknown',
      part_code: sp.parts?.code || null,
      barcode: sp.parts?.barcode || null,
      quantity: sp.quantity || 1
    }));

    // 주문대기 생성
    const result = await createPendingOrder('service', serviceId, brandCode, items);

    return result;

  } catch (err) {
    console.error('A/S 주문대기 추가 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 출고 완료 시 주문대기 추가
 * @param {number} shipmentId - 출고 ID
 * @param {string} brandCode - 브랜드 코드
 * @returns {Object} 처리 결과
 */
export const addShipmentPartsToPendingOrders = async (shipmentId, brandCode) => {
  try {
    // 출고 부품 목록 조회
    const { data: shipmentParts, error } = await supabase
      .from('shipment_parts')
      .select('part_name, part_code, quantity')
      .eq('shipment_id', shipmentId);

    if (error) {
      throw new Error(`출고 부품 조회 실패: ${error.message}`);
    }

    if (!shipmentParts || shipmentParts.length === 0) {
      return {
        success: true,
        message: '주문대기할 부품이 없습니다.',
        skipped: true
      };
    }

    // parts 테이블에서 부품 ID 찾기
    const items = [];
    for (const sp of shipmentParts) {
      let partId = null;
      
      // part_code로 먼저 검색
      if (sp.part_code) {
        const { data: partData } = await supabase
          .from('parts')
          .select('id, barcode')
          .eq('code', sp.part_code)
          .limit(1);
        
        if (partData && partData.length > 0) {
          partId = partData[0].id;
          items.push({
            part_id: partId,
            part_name: sp.part_name,
            part_code: sp.part_code,
            barcode: partData[0].barcode || null,
            quantity: sp.quantity || 1
          });
          continue;
        }
      }

      // part_name으로 검색
      if (sp.part_name) {
        const { data: partData } = await supabase
          .from('parts')
          .select('id, code, barcode')
          .eq('name', sp.part_name)
          .limit(1);
        
        if (partData && partData.length > 0) {
          partId = partData[0].id;
          items.push({
            part_id: partId,
            part_name: sp.part_name,
            part_code: partData[0].code || sp.part_code || null,
            barcode: partData[0].barcode || null,
            quantity: sp.quantity || 1
          });
          continue;
        }
      }

      // 매칭되지 않은 경우에도 추가 (part_id 없이)
      items.push({
        part_id: null,
        part_name: sp.part_name,
        part_code: sp.part_code || null,
        barcode: null,
        quantity: sp.quantity || 1
      });
    }

    // 주문대기 생성
    const result = await createPendingOrder('shipment', shipmentId, brandCode, items);

    return result;

  } catch (err) {
    console.error('출고 주문대기 추가 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 주문대기 목록 조회
 * @param {Object} filters - 필터 옵션 { brand, status, referenceType }
 * @returns {Object} 주문대기 목록
 */
export const getPendingOrders = async (filters = {}) => {
  try {
    let query = supabase
      .from('pending_orders')
      .select(`
        *,
        pending_order_items (*)
      `)
      .order('created_at', { ascending: false });

    if (filters.brand) {
      query = query.eq('brand', filters.brand);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.referenceType) {
      query = query.eq('reference_type', filters.referenceType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`주문대기 목록 조회 실패: ${error.message}`);
    }

    return {
      success: true,
      data: data || []
    };

  } catch (err) {
    console.error('주문대기 목록 조회 중 오류:', err);
    return {
      success: false,
      message: err.message,
      data: []
    };
  }
};

/**
 * 주문대기 상태 업데이트
 * @param {string} orderId - 주문대기 ID
 * @param {string} status - 새로운 상태
 * @returns {Object} 처리 결과
 */
export const updatePendingOrderStatus = async (orderId, status) => {
  try {
    const { data, error } = await supabase
      .from('pending_orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`주문대기 상태 업데이트 실패: ${error.message}`);
    }

    return {
      success: true,
      data
    };

  } catch (err) {
    console.error('주문대기 상태 업데이트 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 주문대기 상품 매칭
 * @param {string} itemId - 주문대기 상품 ID
 * @param {string} websiteProductId - 웹사이트 상품 ID
 * @param {string} websiteProductName - 웹사이트 상품명
 * @returns {Object} 처리 결과
 */
export const matchProductToWebsiteItem = async (itemId, websiteProductId, websiteProductName) => {
  try {
    const { data, error } = await supabase
      .from('pending_order_items')
      .update({
        matched_product_id: websiteProductId,
        matched_product_name: websiteProductName,
        status: 'matched'
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(`상품 매칭 실패: ${error.message}`);
    }

    return {
      success: true,
      data
    };

  } catch (err) {
    console.error('상품 매칭 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 주문 처리 로그 기록
 * @param {string} pendingOrderId - 주문대기 ID
 * @param {string} brand - 브랜드 코드
 * @param {string} status - 처리 상태
 * @param {string} orderId - 웹사이트 주문번호 (선택)
 * @param {string} errorMessage - 오류 메시지 (선택)
 * @returns {Object} 처리 결과
 */
export const createOrderProcessingLog = async (pendingOrderId, brand, status, orderId = null, errorMessage = null) => {
  try {
    const logData = {
      pending_order_id: pendingOrderId,
      brand,
      status,
      order_id: orderId,
      error_message: errorMessage,
      processing_started_at: new Date().toISOString()
    };

    if (status !== 'processing') {
      logData.processing_completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('order_processing_logs')
      .insert(logData)
      .select()
      .single();

    if (error) {
      throw new Error(`주문 처리 로그 기록 실패: ${error.message}`);
    }

    return {
      success: true,
      data
    };

  } catch (err) {
    console.error('주문 처리 로그 기록 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 주문 처리 로그 업데이트
 * @param {string} logId - 로그 ID
 * @param {string} status - 처리 상태
 * @param {string} orderId - 웹사이트 주문번호 (선택)
 * @param {string} errorMessage - 오류 메시지 (선택)
 * @returns {Object} 처리 결과
 */
export const updateOrderProcessingLog = async (logId, status, orderId = null, errorMessage = null) => {
  try {
    const updateData = {
      status,
      processing_completed_at: new Date().toISOString()
    };

    if (orderId) {
      updateData.order_id = orderId;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { data, error } = await supabase
      .from('order_processing_logs')
      .update(updateData)
      .eq('id', logId)
      .select()
      .single();

    if (error) {
      throw new Error(`주문 처리 로그 업데이트 실패: ${error.message}`);
    }

    return {
      success: true,
      data
    };

  } catch (err) {
    console.error('주문 처리 로그 업데이트 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 주문대기 상품 상태 업데이트
 * @param {string} itemId - 주문대기 상품 ID
 * @param {string} status - 새로운 상태
 * @returns {Object} 처리 결과
 */
export const updatePendingOrderItemStatus = async (itemId, status) => {
  try {
    const { data, error } = await supabase
      .from('pending_order_items')
      .update({ status })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(`주문대기 상품 상태 업데이트 실패: ${error.message}`);
    }

    return {
      success: true,
      data
    };

  } catch (err) {
    console.error('주문대기 상품 상태 업데이트 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * 주문 완료 후 주문대기 상품 상태 업데이트
 * @param {Array} itemIds - 주문대기 상품 ID 배열
 * @returns {Object} 처리 결과
 */
export const updatePendingOrderItemsToOrdered = async (itemIds) => {
  try {
    const { data, error } = await supabase
      .from('pending_order_items')
      .update({ status: 'ordered' })
      .in('id', itemIds)
      .select();

    if (error) {
      throw new Error(`주문대기 상품 상태 업데이트 실패: ${error.message}`);
    }

    return {
      success: true,
      data
    };

  } catch (err) {
    console.error('주문대기 상품 상태 업데이트 중 오류:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

