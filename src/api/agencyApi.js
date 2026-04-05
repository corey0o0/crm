import { supabase } from '../lib/supabaseClient';

export const agencyApi = {
  // 모든 대리점 조회
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('대리점 조회 오류:', error);
      throw error;
    }
  },

  // 대리점 생성
  async create(agency) {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .insert([agency])
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
      const { data, error } = await supabase
        .from('agencies')
        .update(updates)
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
        .from('agencies')
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
  async createMany(agencies) {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .insert(agencies)
        .select();
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('대리점 일괄 생성 오류:', error);
      throw error;
    }
  }
};
