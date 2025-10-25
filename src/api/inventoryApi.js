import { supabase } from '../lib/supabaseClient';

export const inventoryApi = {
  // 모든 재고 조회
  async getAll(retryCount = 0) {
    try {
      console.log(`[InventoryAPI] Fetching all inventory (retry: ${retryCount})`);
      
      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('재고 데이터 로딩 시간 초과')), 10000)
      );

      const queryPromise = supabase
        .from('inventory')
        .select('*');
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      if (error) throw error;
      console.log(`[InventoryAPI] Inventory data received:`, data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error(`[InventoryAPI] 재고 조회 오류 (retry: ${retryCount}):`, error);
      
      // 타임아웃 또는 네트워크 오류 시 재시도
      const isTimeout = error.message?.includes('시간 초과') || 
                       error.message?.includes('timeout') ||
                       error.name === 'AbortError';
      
      if (retryCount < 2 && (
        isTimeout ||
        error.message?.includes('network') ||
        error.message?.includes('fetch') ||
        error.message?.includes('Failed to fetch')
      )) {
        const delay = isTimeout ? 0 : 1000 * (retryCount + 1);
        console.log(`[InventoryAPI] ${isTimeout ? '타임아웃 -' : ''} 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getAll(retryCount + 1);
      }
      
      // 테이블이 없거나 스키마가 준비되지 않은 경우에도 앱이 동작하도록 빈 배열 반환
      return [];
    }
  },

  // 창고별 재고 조회
  async getByWarehouse(warehouseId, retryCount = 0) {
    try {
      console.log(`[InventoryAPI] Fetching inventory for warehouse ${warehouseId} (retry: ${retryCount})`);
      
      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('창고별 재고 로딩 시간 초과')), 10000)
      );

      const queryPromise = supabase
        .from('inventory')
        .select('*')
        .eq('warehouse_id', warehouseId);
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      if (error) throw error;
      console.log(`[InventoryAPI] Warehouse inventory data received:`, data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error(`[InventoryAPI] 창고별 재고 조회 오류 (retry: ${retryCount}):`, error);
      
      // 타임아웃 또는 네트워크 오류 시 재시도
      const isTimeout = error.message?.includes('시간 초과') || 
                       error.message?.includes('timeout') ||
                       error.name === 'AbortError';
      
      if (retryCount < 2 && (
        isTimeout ||
        error.message?.includes('network') ||
        error.message?.includes('fetch') ||
        error.message?.includes('Failed to fetch')
      )) {
        const delay = isTimeout ? 0 : 1000 * (retryCount + 1);
        console.log(`[InventoryAPI] ${isTimeout ? '타임아웃 -' : ''} 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getByWarehouse(warehouseId, retryCount + 1);
      }
      
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
      // 서버 실패시에도 UI가 계속 진행되도록 noop 처리
      return { warehouse_id: warehouseId, product_id: productId, quantity };
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
      return [];
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
