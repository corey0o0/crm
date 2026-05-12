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
      isGrouped: row.is_grouped ?? false,
      status: row.status ?? '완료'
    };
  },
  // 최근 거래내역 조회 (기본 500건으로 제한하여 로딩 속도 개선)
  async getRecent(limit = 500) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (error) throw error;
      return data.map(this._mapRow);
    } catch (error) {
      console.error('최근 거래내역 조회 오류:', error);
      throw error;
    }
  },

  // 모든 거래내역 조회 (페이지네이션으로 전체 데이터 가져오기 - 백그라운드 로드용)
  async getAll() {
    try {
      let allData = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);
        
        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      console.log(`[transactionApi] 전체 ${allData.length}건의 거래내역을 백그라운드에서 가져왔습니다.`);
      return allData.map(this._mapRow);
    } catch (error) {
      console.error('전체 거래내역 조회 오류:', error);
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
        product_supplier: transaction.productSupplier ?? null,
        quantity: transaction.quantity,
        from_location: transaction.fromLocation ?? null,
        to_location: transaction.toLocation ?? null,
        date: transaction.date,
        note: transaction.note ?? null,
        additional_note: transaction.additionalNote ?? null,
        is_grouped: transaction.isGrouped ?? false,
        status: transaction.status ?? '완료'
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
        product_supplier: t.productSupplier ?? null,
        quantity: t.quantity,
        from_location: t.fromLocation ?? null,
        to_location: t.toLocation ?? null,
        date: t.date,
        note: t.note ?? null,
        additional_note: t.additionalNote ?? null,
        is_grouped: t.isGrouped ?? false,
        status: t.status ?? '완료'
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
        product_supplier: updates.productSupplier ?? null,
        quantity: updates.quantity,
        from_location: updates.fromLocation ?? null,
        to_location: updates.toLocation ?? null,
        date: updates.date,
        note: updates.note ?? null,
        additional_note: updates.additionalNote ?? null,
        is_grouped: updates.isGrouped ?? false,
        status: updates.status ?? '완료'
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
  async getByDateRange(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(this._mapRow);
    } catch (error) {
      console.error('날짜 범위 거래내역 조회 오류:', error);
      throw error;
    }
  },

  // 특정 창고/대리점의 거래내역 조회
  async getByLocation(locationId) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`from_location.eq.${locationId},to_location.eq.${locationId}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(this._mapRow);
    } catch (error) {
      console.error('위치별 거래내역 조회 오류:', error);
      throw error;
    }
  }
};
