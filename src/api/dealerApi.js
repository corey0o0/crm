import { supabase } from '../lib/supabaseClient';

export const dealerApi = {
  // 모든 대리점 조회
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('대리점 조회 오류:', error);
      throw error;
    }
  },

  // 대리점 생성
  async create(dealer) {
    try {
      const payload = {
        id: dealer.id,
        name: dealer.name,
        location: dealer.location,
        phone: dealer.phone ?? null,
        manager: dealer.manager ?? null,
        address: dealer.address ?? null,
        created_at: dealer.createdAt ?? new Date().toISOString(),
        updated_at: dealer.updatedAt ?? new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('dealers')
        .insert([payload])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('대리점 생성 오류:', error);
      throw error;
    }
  },

  // 대리점 수정
  async update(id, updates) {
    try {
      const payload = {
        name: updates.name,
        location: updates.location,
        phone: updates.phone ?? null,
        manager: updates.manager ?? null,
        address: updates.address ?? null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('dealers')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('대리점 수정 오류:', error);
      throw error;
    }
  },

  // 대리점 삭제
  async delete(id) {
    try {
      const { error } = await supabase
        .from('dealers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('대리점 삭제 오류:', error);
      throw error;
    }
  },

  // 여러 대리점 일괄 생성
  async createMany(dealers) {
    try {
      const rows = dealers.map(d => ({
        id: d.id,
        name: d.name,
        location: d.location,
        phone: d.phone ?? null,
        manager: d.manager ?? null,
        address: d.address ?? null,
        created_at: d.createdAt ?? new Date().toISOString(),
        updated_at: d.updatedAt ?? new Date().toISOString()
      }));
      const { data, error } = await supabase
        .from('dealers')
        .insert(rows)
        .select();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('대리점 일괄 생성 오류:', error);
      throw error;
    }
  }
};
