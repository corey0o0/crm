import { supabase } from '../lib/supabaseClient';

// 창고 숨김 여부 판정 — 숨김 처리는 별도 컬럼 없이 note에 '[HIDDEN]' 마커를 넣는 방식(LocationManagement.jsx)
export const isWarehouseHidden = (warehouse) => (warehouse?.note || '').includes('[HIDDEN]');

export const warehouseApi = {
  // 모든 창고 조회 (숨김 포함)
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('창고 조회 오류:', error);
      throw error;
    }
  },

  // 숨김 처리되지 않은 창고만 조회
  async getVisible() {
    const all = await this.getAll();
    return all.filter((w) => !isWarehouseHidden(w));
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
        note: updates.note ?? null,
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
