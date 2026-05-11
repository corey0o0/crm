import { supabase } from '../lib/supabaseClient';

export const inventoryApi = {
  // 모든 재고 조회
  async getAll() {
    try {
      // 관계가 아직 설정되지 않았을 수 있으므로 단순 선택으로 제한
      const { data, error } = await supabase
        .from('inventory')
        .select('*');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('재고 조회 오류:', error);
      // 테이블이 없거나 스키마가 준비되지 않은 경우에도 앱이 동작하도록 빈 배열 반환
      return [];
    }
  },

  // 창고별 재고 조회
  async getByWarehouse(warehouseId) {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('warehouse_id', warehouseId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('창고별 재고 조회 오류:', error);
      return [];
    }
  },

  // 재고 생성 또는 업데이트
  async upsert(warehouseId, productId, quantity) {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .upsert({
          warehouse_id: warehouseId,
          product_id: productId,
          quantity: quantity,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'warehouse_id,product_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('재고 업데이트 오류:', error);
      throw error;
    }
  },

  // 여러 재고 일괄 업데이트
  async upsertMany(inventoryUpdates) {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .upsert(inventoryUpdates.map(update => ({
          ...update,
          updated_at: new Date().toISOString()
        })), {
          onConflict: 'warehouse_id,product_id'
        })
        .select();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('재고 일괄 업데이트 오류:', error);
      throw error;
    }
  },

  // 모든 재고 삭제 (초기화)
  async clearAll() {
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .not('warehouse_id', 'is', null);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('전체 재고 초기화 오류:', error);
      return false;
    }
  },

  // 재고 삭제
  async delete(warehouseId, productId) {
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('warehouse_id', warehouseId)
        .eq('product_id', productId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('재고 삭제 오류:', error);
      return false;
    }
  },

  // 창고의 모든 재고 삭제
  async deleteByWarehouse(warehouseId) {
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('warehouse_id', warehouseId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('창고 재고 삭제 오류:', error);
      return false;
    }
  }
};
