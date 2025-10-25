import { supabase } from '../lib/supabaseClient';

export const warehouseApi = {
  // 모든 창고 조회
  async getAll(retryCount = 0) {
    try {
      console.log(`[WarehouseAPI] Fetching all warehouses (retry: ${retryCount})`);
      
      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('창고 데이터 로딩 시간 초과')), 10000)
      );

      const queryPromise = supabase
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: true });
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      if (error) throw error;
      console.log(`[WarehouseAPI] Warehouse data received:`, data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error(`[WarehouseAPI] 창고 조회 오류 (retry: ${retryCount}):`, error);
      
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
        console.log(`[WarehouseAPI] ${isTimeout ? '타임아웃 -' : ''} 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getAll(retryCount + 1);
      }
      
      throw error;
    }
  },

  // 창고 생성
  async create(warehouse) {
    try {
      const payload = {
        id: warehouse.id,
        name: warehouse.name,
        location: warehouse.location,
        phone: warehouse.phone ?? null,
        manager: warehouse.manager ?? null,
        address: warehouse.address ?? null,
        stock_sync: warehouse.stockSync ?? warehouse.stock_sync ?? false,
        sync_with_product_stock: warehouse.syncWithProductStock ?? warehouse.sync_with_product_stock ?? false,
        created_at: warehouse.createdAt ?? new Date().toISOString(),
        updated_at: warehouse.updatedAt ?? new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('warehouses')
        .insert([payload])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('창고 생성 오류:', error);
      throw error;
    }
  },

  // 창고 수정
  async update(id, updates) {
    try {
      const payload = {
        name: updates.name,
        location: updates.location,
        phone: updates.phone ?? null,
        manager: updates.manager ?? null,
        address: updates.address ?? null,
        stock_sync: updates.stockSync ?? updates.stock_sync,
        sync_with_product_stock: updates.syncWithProductStock ?? updates.sync_with_product_stock,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('warehouses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('창고 수정 오류:', error);
      throw error;
    }
  },

  // 창고 삭제
  async delete(id) {
    try {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('창고 삭제 오류:', error);
      throw error;
    }
  },

  // 여러 창고 일괄 생성
  async createMany(warehouses) {
    try {
      const rows = warehouses.map(w => ({
        id: w.id,
        name: w.name,
        location: w.location,
        phone: w.phone ?? null,
        manager: w.manager ?? null,
        address: w.address ?? null,
        stock_sync: w.stockSync ?? w.stock_sync ?? false,
        sync_with_product_stock: w.syncWithProductStock ?? w.sync_with_product_stock ?? false,
        created_at: w.createdAt ?? new Date().toISOString(),
        updated_at: w.updatedAt ?? new Date().toISOString()
      }));
      const { data, error } = await supabase
        .from('warehouses')
        .insert(rows)
        .select();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('창고 일괄 생성 오류:', error);
      throw error;
    }
  }
};
