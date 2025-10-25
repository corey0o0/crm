import { supabase } from '../lib/supabaseClient';

export const dealerApi = {
  // 모든 대리점 조회
  async getAll(retryCount = 0) {
    try {
      console.log(`[DealerAPI] Fetching all dealers (retry: ${retryCount})`);
      
      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('대리점 데이터 로딩 시간 초과')), 10000)
      );

      const queryPromise = supabase
        .from('dealers')
        .select('*')
        .order('created_at', { ascending: true });
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      if (error) throw error;
      console.log(`[DealerAPI] Dealer data received:`, data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error(`[DealerAPI] 대리점 조회 오류 (retry: ${retryCount}):`, error);
      
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
        console.log(`[DealerAPI] ${isTimeout ? '타임아웃 -' : ''} 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getAll(retryCount + 1);
      }
      
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
