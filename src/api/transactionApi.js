import { supabase } from '../lib/supabaseClient';

export const transactionApi = {
  // snake_case → camelCase 매핑
  _mapRow(row) {
    if (!row) return row;
    return {
      id: row.id,
      groupId: row.group_id ?? null,
      type: row.type,
      productId: row.product_id,
      productName: row.product_name,
      productCode: row.product_code ?? null,
      productSupplier: row.product_supplier ?? null,
      quantity: row.quantity,
      fromLocation: row.from_location ?? null,
      toLocation: row.to_location ?? null,
      date: row.date,
      note: row.note ?? null,
      additionalNote: row.additional_note ?? null,
      createdAt: row.created_at ?? null,
      isGrouped: row.is_grouped ?? false
    };
  },
  // 모든 거래내역 조회
  async getAll(retryCount = 0) {
    try {
      console.log(`[TransactionAPI] Fetching all transactions (retry: ${retryCount})`);
      
      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('거래내역 데이터 로딩 시간 초과')), 10000)
      );

      const queryPromise = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      if (error) throw error;
      console.log(`[TransactionAPI] Transaction data received:`, data?.length || 0, 'items');
      return (data || []).map(this._mapRow);
    } catch (error) {
      console.error(`[TransactionAPI] 거래내역 조회 오류 (retry: ${retryCount}):`, error);
      
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
        console.log(`[TransactionAPI] ${isTimeout ? '타임아웃 -' : ''} 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getAll(retryCount + 1);
      }
      
      throw error;
    }
  },

  // 거래내역 생성
  async create(transaction) {
    try {
      const payload = {
        group_id: transaction.groupId ?? transaction.group_id ?? null,
        type: transaction.type,
        product_id: transaction.productId,
        product_name: transaction.productName,
        product_code: transaction.productCode ?? null,
        product_supplier: transaction.productSupplier ?? 'NEARBIKE',
        quantity: transaction.quantity,
        from_location: transaction.fromLocation ?? null,
        to_location: transaction.toLocation ?? null,
        date: transaction.date,
        note: transaction.note ?? null,
        additional_note: transaction.additionalNote ?? null,
        is_grouped: transaction.isGrouped ?? false
      };
      const { data, error } = await supabase
        .from('transactions')
        .insert([payload])
        .select()
        .single();
      
      if (error) throw error;
      return this._mapRow(data);
    } catch (error) {
      console.error('거래내역 생성 오류:', error);
      throw error;
    }
  },

  // 여러 거래내역 일괄 생성
  async createMany(transactions) {
    try {
      const rows = transactions.map(t => ({
        group_id: t.groupId ?? t.group_id ?? null,
        type: t.type,
        product_id: t.productId,
        product_name: t.productName,
        product_code: t.productCode ?? null,
        product_supplier: t.productSupplier ?? 'NEARBIKE',
        quantity: t.quantity,
        from_location: t.fromLocation ?? null,
        to_location: t.toLocation ?? null,
        date: t.date,
        note: t.note ?? null,
        additional_note: t.additionalNote ?? null,
        is_grouped: t.isGrouped ?? false
      }));
      const { data, error } = await supabase
        .from('transactions')
        .insert(rows)
        .select();
      
      if (error) throw error;
      return (data || []).map(this._mapRow);
    } catch (error) {
      console.error('거래내역 일괄 생성 오류:', error);
      throw error;
    }
  },

  // 거래내역 수정
  async update(id, updates) {
    try {
      const payload = {
        group_id: updates.groupId ?? updates.group_id ?? null,
        type: updates.type,
        product_id: updates.productId,
        product_name: updates.productName,
        product_code: updates.productCode ?? null,
        product_supplier: updates.productSupplier ?? 'NEARBIKE',
        quantity: updates.quantity,
        from_location: updates.fromLocation ?? null,
        to_location: updates.toLocation ?? null,
        date: updates.date,
        note: updates.note ?? null,
        additional_note: updates.additionalNote ?? null,
        is_grouped: updates.isGrouped ?? false
      };
      const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return this._mapRow(data);
    } catch (error) {
      console.error('거래내역 수정 오류:', error);
      throw error;
    }
  },

  // 거래내역 삭제
  async delete(id) {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('거래내역 삭제 오류:', error);
      throw error;
    }
  },

  // 그룹 ID로 거래내역 삭제
  async deleteByGroupId(groupId) {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('group_id', groupId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('그룹 거래내역 삭제 오류:', error);
      throw error;
    }
  },

  // 날짜 범위로 거래내역 조회
  async getByDateRange(startDate, endDate, retryCount = 0) {
    try {
      console.log(`[TransactionAPI] Fetching transactions by date range (retry: ${retryCount})`);
      
      // 10초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('날짜 범위 거래내역 로딩 시간 초과')), 10000)
      );

      const queryPromise = supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('created_at', { ascending: false });
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      
      if (error) throw error;
      console.log(`[TransactionAPI] Date range transaction data received:`, data?.length || 0, 'items');
      return (data || []).map(this._mapRow);
    } catch (error) {
      console.error(`[TransactionAPI] 날짜 범위 거래내역 조회 오류 (retry: ${retryCount}):`, error);
      
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
        console.log(`[TransactionAPI] ${isTimeout ? '타임아웃 -' : ''} 재시도 중... (${retryCount + 1}/2, ${delay}ms 후)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.getByDateRange(startDate, endDate, retryCount + 1);
      }
      
      throw error;
    }
  }
};
