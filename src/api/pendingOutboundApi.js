import { supabase } from '../lib/supabaseClient';

export const pendingOutboundApi = {
  // 대기열 목록 조회
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('pending_outbounds')
        .select(`
          *,
          items:pending_outbound_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching pending outbounds:', error);
      throw error;
    }
  },

  // 새 출고 대기열 생성 (AS, 일반수동출고 등에서 호출)
  async create(outboundData) {
    try {
      const { items, ...headerData } = outboundData;
      
      // 1. 헤더 생성
      const { data: header, error: headerError } = await supabase
        .from('pending_outbounds')
        .insert([headerData])
        .select()
        .single();
        
      if (headerError) throw headerError;
      
      // 2. 품목 생성
      if (items && items.length > 0) {
        const itemsWithRef = items.map(item => ({
          ...item,
          pending_id: header.id
        }));
        
        const { error: itemsError } = await supabase
          .from('pending_outbound_items')
          .insert(itemsWithRef);
          
        if (itemsError) throw itemsError;
      }
      
      return header;
    } catch (error) {
      console.error('Error creating pending outbound:', error);
      throw error;
    }
  },

  // 상태 변경 (검수 완료 후 출고 등)
  async updateStatus(id, status) {
    try {
      // Fetch the transaction_ids first
      const { data: po } = await supabase
        .from('pending_outbounds')
        .select('transaction_ids')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('pending_outbounds')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Update linked transactions to '완료' if they exist
      if (status === '완료' && po && po.transaction_ids && po.transaction_ids.length > 0) {
        const { error: txErr } = await supabase
          .from('transactions')
          .update({ status: '완료' })
          .in('id', po.transaction_ids);
        if (txErr) console.error('Failed to update linked transactions:', txErr);
      }

      return true;
    } catch (error) {
      console.error('Error updating pending outbound status:', error);
      throw error;
    }
  },
  
  // 검수 후 실물 스캔 이력 업데이트
  async updateScannedItems(items) {
    try {
      // 복수 아이템 업데이트 (간단히 루프로 처리)
      for (const item of items) {
        const { error } = await supabase
          .from('pending_outbound_items')
          .update({ scanned_qty: item.scanned })
          .eq('id', item.id);
          
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error('Error updating scanned items:', error);
      throw error;
    }
  }
};
