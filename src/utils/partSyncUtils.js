import { supabase } from '../lib/supabaseClient';

/**
 * 특정 파츠의 연동된 파츠 목록 조회
 * @param {number} partId - 파츠 ID
 * @returns {Promise<Array>} 연동된 파츠 목록 (파츠 정보 포함)
 */
export const getSyncedParts = async (partId) => {
  try {
    // part_id_1 또는 part_id_2 중 하나가 해당 파츠인 모든 연동 관계 조회
    const { data, error } = await supabase
      .from('part_sync_relations')
      .select(`
        id,
        part_id_1,
        part_id_2
      `)
      .or(`part_id_1.eq.${partId},part_id_2.eq.${partId}`);

    if (error) throw error;

    // 연동된 파츠 ID 목록 추출
    const syncedPartIds = [];
    (data || []).forEach(relation => {
      if (relation.part_id_1 === partId) {
        syncedPartIds.push({ relationId: relation.id, partId: relation.part_id_2 });
      } else if (relation.part_id_2 === partId) {
        syncedPartIds.push({ relationId: relation.id, partId: relation.part_id_1 });
      }
    });

    if (syncedPartIds.length === 0) {
      return [];
    }

    // 연동된 파츠 정보 조회
    const partIds = syncedPartIds.map(sp => sp.partId);
    const { data: partsData, error: partsError } = await supabase
      .from('parts')
      .select('id, name, code, brand, stock')
      .in('id', partIds);

    if (partsError) {
      console.error('연동 파츠 정보 조회 실패:', partsError);
      return [];
    }

    // 관계 ID와 파츠 정보 매칭
    const syncedParts = syncedPartIds.map(sp => {
      const part = partsData?.find(p => p.id === sp.partId);
      return part ? {
        relationId: sp.relationId,
        part: part
      } : null;
    }).filter(Boolean);

    return syncedParts;
  } catch (err) {
    console.error('연동된 파츠 조회 실패:', err);
    return [];
  }
};

/**
 * 연동 관계 생성
 * @param {number} partId1 - 첫 번째 파츠 ID
 * @param {number} partId2 - 두 번째 파츠 ID
 * @returns {Promise<Object>} 생성 결과
 */
export const createSyncRelation = async (partId1, partId2) => {
  try {
    // 동일한 파츠인지 확인
    if (partId1 === partId2) {
      return {
        success: false,
        error: '같은 파츠는 연동할 수 없습니다.'
      };
    }

    // 이미 연동 관계가 있는지 확인
    const existing = await checkSyncRelation(partId1, partId2);
    if (existing) {
      return {
        success: false,
        error: '이미 연동 관계가 존재합니다.'
      };
    }

    // 연동 관계 생성 (작은 ID를 part_id_1로 설정하여 일관성 유지)
    const [id1, id2] = partId1 < partId2 ? [partId1, partId2] : [partId2, partId1];

    const { data, error } = await supabase
      .from('part_sync_relations')
      .insert([{
        part_id_1: id1,
        part_id_2: id2
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data
    };
  } catch (err) {
    console.error('연동 관계 생성 실패:', err);
    return {
      success: false,
      error: err.message || '연동 관계 생성에 실패했습니다.'
    };
  }
};

/**
 * 연동 관계 삭제
 * @param {number} partId1 - 첫 번째 파츠 ID
 * @param {number} partId2 - 두 번째 파츠 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteSyncRelation = async (partId1, partId2) => {
  try {
    // 연동 관계 ID로 삭제하거나 part_id 조합으로 삭제
    const { error } = await supabase
      .from('part_sync_relations')
      .delete()
      .or(`and(part_id_1.eq.${partId1},part_id_2.eq.${partId2}),and(part_id_1.eq.${partId2},part_id_2.eq.${partId1})`);

    if (error) throw error;

    return {
      success: true
    };
  } catch (err) {
    console.error('연동 관계 삭제 실패:', err);
    return {
      success: false,
      error: err.message || '연동 관계 삭제에 실패했습니다.'
    };
  }
};

/**
 * 연동 관계 ID로 삭제
 * @param {string} relationId - 연동 관계 ID
 * @returns {Promise<Object>} 삭제 결과
 */
export const deleteSyncRelationById = async (relationId) => {
  try {
    const { error } = await supabase
      .from('part_sync_relations')
      .delete()
      .eq('id', relationId);

    if (error) throw error;

    return {
      success: true
    };
  } catch (err) {
    console.error('연동 관계 삭제 실패:', err);
    return {
      success: false,
      error: err.message || '연동 관계 삭제에 실패했습니다.'
    };
  }
};

/**
 * 두 파츠 간 연동 관계 존재 여부 확인
 * @param {number} partId1 - 첫 번째 파츠 ID
 * @param {number} partId2 - 두 번째 파츠 ID
 * @returns {Promise<boolean>} 연동 관계 존재 여부
 */
export const checkSyncRelation = async (partId1, partId2) => {
  try {
    const { data, error } = await supabase
      .from('part_sync_relations')
      .select('id')
      .or(`and(part_id_1.eq.${partId1},part_id_2.eq.${partId2}),and(part_id_1.eq.${partId2},part_id_2.eq.${partId1})`)
      .limit(1);

    if (error) throw error;

    return data && data.length > 0;
  } catch (err) {
    console.error('연동 관계 확인 실패:', err);
    return false;
  }
};

/**
 * 모든 연동 관계 조회
 * @returns {Promise<Array>} 모든 연동 관계 목록
 */
export const getAllSyncRelations = async () => {
  try {
    const { data, error } = await supabase
      .from('part_sync_relations')
      .select(`
        id,
        part_id_1,
        part_id_2,
        created_at,
        parts_1:parts!part_sync_relations_part_id_1_fkey (
          id,
          name,
          code,
          brand,
          stock
        ),
        parts_2:parts!part_sync_relations_part_id_2_fkey (
          id,
          name,
          code,
          brand,
          stock
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('연동 관계 목록 조회 실패:', err);
    return [];
  }
};

/**
 * 연동된 모든 파츠의 재고 동시 업데이트
 * @param {number} partId - 기준 파츠 ID
 * @param {number} quantityChange - 재고 변경량 (음수면 차감, 양수면 증가)
 * @returns {Promise<Object>} 업데이트 결과
 */
export const syncStockUpdate = async (partId, quantityChange) => {
  try {
    // 연동된 파츠 목록 조회
    const syncedParts = await getSyncedParts(partId);
    
    // 연동된 파츠 ID 목록 (자기 자신 포함)
    const partIds = [partId, ...syncedParts.map(sp => sp.part.id)];

    // 모든 파츠의 현재 재고 조회
    const { data: partsData, error: fetchError } = await supabase
      .from('parts')
      .select('id, stock')
      .in('id', partIds);

    if (fetchError) throw fetchError;

    // 각 파츠의 재고 업데이트
    const updatePromises = partsData.map(part => {
      const newStock = Math.max(0, (part.stock || 0) + quantityChange);
      return supabase
        .from('parts')
        .update({ 
          stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', part.id);
    });

    const results = await Promise.all(updatePromises);
    
    // 에러 확인
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      throw new Error(`일부 파츠 재고 업데이트 실패: ${errors.map(e => e.error.message).join(', ')}`);
    }

    return {
      success: true,
      updatedCount: partIds.length
    };
  } catch (err) {
    console.error('연동 재고 업데이트 실패:', err);
    return {
      success: false,
      error: err.message || '연동 재고 업데이트에 실패했습니다.'
    };
  }
};

