// 판매/입출고 등록 시점 중복 검사 유틸
// 4가지 기준: 주문번호 중복(출고) · 출고↔온라인 이중집계 · 동일고객/동일상품/동일일자 · 트랜잭션 중복
import { supabase } from '../lib/supabaseClient';

export const ORDER_NO_PATTERN = /(20\d{6}-\d{7})/;
export const MALL_PREFIXES = ['nearbike_'];

export function extractOrderNo(text) {
  if (!text) return null;
  const m = String(text).match(ORDER_NO_PATTERN);
  return m ? m[0] : null;
}

const dayRange = (d) => {
  const day = String(d).slice(0, 10);
  return [`${day}T00:00:00+09:00`, `${day}T23:59:59+09:00`, day];
};

// 판매(매장출고/수기판매) 등록 시 중복 검사 → 경고 배열 반환
// args: { note, trackingNumber, customerName, orderDate, parts:[{name|part_name, code|part_code, quantity}], excludeId }
export async function checkSaleDuplicate({ note, trackingNumber, customerName, orderDate, parts = [], excludeId = null }) {
  const warnings = [];
  const orderNo = extractOrderNo(note) || extractOrderNo(trackingNumber);

  // 1) 주문번호 중복 — 같은 주문번호가 다른 출고건에 이미 등록됨
  if (orderNo) {
    let q = supabase
      .from('shipments')
      .select('id, customer_name, order_date, status, note')
      .or(`note.ilike."%${orderNo}%",tracking_number.ilike."%${orderNo}%"`)
      .limit(20);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    const dups = (data || []).filter(s => s.status !== '취소');
    if (dups.length > 0) {
      warnings.push({
        type: 'order_no',
        message: `동일 주문번호(${orderNo})가 이미 등록된 출고건 ${dups.length}건이 있습니다.`,
        refs: dups.map(d => `${d.customer_name || '-'} · ${String(d.order_date || '').slice(0, 10)} · ${d.status || '-'}`),
      });
    }

    // 2) 출고 ↔ 온라인 이중집계 — 이 주문이 온라인 주문관리에 이미 반영(전송완료)됨
    const ids = [orderNo, ...MALL_PREFIXES.map(p => `${p}${orderNo}`)];
    const { data: cafe } = await supabase
      .from('cafe24_orders')
      .select('order_id, total_amount')
      .in('order_id', ids)
      .eq('is_deleted', false)
      .eq('is_transferred', true);
    if ((cafe || []).length > 0) {
      warnings.push({
        type: 'cafe24_overlap',
        message: `주문번호 ${orderNo}는 온라인 주문관리에 이미 반영(전송완료)되어 있습니다. 매장출고로도 등록하면 판매현황에서 이중집계됩니다.`,
        refs: cafe.map(c => `${c.order_id} · ${Number(c.total_amount || 0).toLocaleString()}원`),
      });
    }
  }

  // 3) 동일고객 · 동일일자 · 동일상품
  if (customerName && orderDate && parts.length > 0) {
    const [from, to, day] = dayRange(orderDate);
    let q = supabase
      .from('shipments')
      .select('id, customer_name, order_date, status, shipment_parts(part_name, part_code)')
      .eq('customer_name', String(customerName).trim())
      .gte('order_date', from)
      .lte('order_date', to)
      .limit(30);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    const myCodes = new Set(parts.map(p => String(p.code || p.part_code || '').trim()).filter(Boolean));
    const myNames = new Set(parts.map(p => String(p.name || p.part_name || '').trim()).filter(Boolean));
    const overlapping = (data || []).filter(s =>
      s.status !== '취소' &&
      (s.shipment_parts || []).some(sp =>
        (sp.part_code && myCodes.has(String(sp.part_code).trim())) ||
        (sp.part_name && myNames.has(String(sp.part_name).trim()))
      )
    );
    if (overlapping.length > 0) {
      warnings.push({
        type: 'same_customer_product_date',
        message: `같은 날(${day}) 동일 고객(${customerName})에게 동일 상품이 등록된 출고건 ${overlapping.length}건이 있습니다.`,
        refs: overlapping.map(s => `${s.status || '-'} · ${(s.shipment_parts || []).map(p => p.part_name).join(', ')}`),
      });
    }
  }

  return warnings;
}

// 입출고 직접등록 트랜잭션 중복 검사 → 경고 배열 반환
// transactions: [{ productId, productName, type, quantity, fromLocation, toLocation, date }]
export async function checkTransactionDuplicate(transactions = []) {
  const warnings = [];
  for (const t of transactions) {
    const qty = parseInt(t.quantity, 10) || 0;
    if (!t.productId || qty === 0) continue;
    const day = String(t.date).slice(0, 10);
    // 인덱스 친화: 상품+유형+수량으로 좁힌 뒤 날짜·위치는 JS에서 비교 (date 컬럼 포맷 편차 대비)
    const { data } = await supabase
      .from('transactions')
      .select('id, product_id, type, quantity, from_location, to_location, date, note')
      .eq('product_id', t.productId)
      .eq('type', t.type)
      .eq('quantity', qty)
      .limit(50);
    const dups = (data || []).filter(r =>
      String(r.date).slice(0, 10) === day &&
      String(r.from_location || '') === String(t.fromLocation || '') &&
      String(r.to_location || '') === String(t.toLocation || '')
    );
    if (dups.length > 0) {
      warnings.push({
        type: 'tx_dup',
        message: `${t.productName || t.productId} ${qty}개 (${t.type === 'in' ? '입고' : '출고'}) — 같은 날 동일 트랜잭션 ${dups.length}건이 이미 있습니다.`,
        refs: dups.map(d => `${String(d.date).slice(0, 10)} · ${d.note || '메모없음'}`),
      });
    }
  }
  return warnings;
}
