'use strict';
const { getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight } = require('./_chatbot_utils');

const CAFE24_STATUS_KO = {
  'N00':'입금전','N10':'상품준비중','N20':'배송준비중','N21':'배송대기','N22':'배송보류',
  'N30':'배송중','N40':'배송완료','N50':'배송완료',
  'C00':'취소신청','C10':'취소접수','C34':'취소처리중','C36':'취소처리중',
  'C40':'취소완료','C47':'취소완료','C48':'취소완료','C49':'취소완료',
  'R00':'반품신청','R10':'반품접수','R12':'반품보류','R30':'반품처리중',
  'R34':'반품처리중','R36':'반품처리중','R40':'반품완료',
  'E00':'교환신청','E10':'교환접수','E12':'교환보류','E20':'교환준비',
  'E30':'교환처리중','E32':'교환처리중','E34':'교환처리중','E36':'교환처리중','E40':'교환완료',
  'M':'배송준비중','T':'배송중','F':'배송완료','W':'배송보류',
};

const CANCEL_STATUS = ['C11','C40','R40','E40'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const supabase = getSupabase();
  const ip = getIp(event);
  const p = event.queryStringParameters || {};
  const { order_id, phone_last4, mall_id } = p;

  if (!order_id || !phone_last4 || !mall_id) {
    return err(400, 'order_id, phone_last4, mall_id 필수');
  }

  const { allowed, count, limit } = await checkRateLimit(supabase, ip, 'order');
  if (!allowed) {
    return err(429, `일일 주문 조회 한도(${limit}회)를 초과했습니다. 내일 다시 시도해주세요.`);
  }

  const selectCols = 'order_id, buyer_phone, order_date, status, total_amount, shipping_fee, order_items';
  const mallId = mall_id.trim();
  const rawId = order_id.trim();

  // 1차: 입력값 그대로
  let { data, error } = await supabase
    .from('cafe24_orders')
    .select(selectCols)
    .eq('order_id', rawId)
    .eq('mall_id', mallId)
    .eq('is_deleted', false)
    .maybeSingle();

  // 2차: mall_id 접두사 붙여서 재시도 (예: nearbike_20260522-0000023)
  if (!data && !error) {
    const prefixed = `${mallId}_${rawId}`;
    ({ data, error } = await supabase
      .from('cafe24_orders')
      .select(selectCols)
      .eq('order_id', prefixed)
      .eq('mall_id', mallId)
      .eq('is_deleted', false)
      .maybeSingle());
  }

  if (error) return err(500, error.message);
  if (!data) return ok({ found: false });

  const phone = (data.buyer_phone || '').replace(/\D/g, '');
  if (!phone.endsWith(phone_last4.trim())) return ok({ found: true, verified: false });

  const rawItems = data.order_items || [];
  const validItems = rawItems.filter(it => !CANCEL_STATUS.includes(it.order_status));
  const items = validItems.map(it => ({
    name: it.product_name || it.name || '상품',
    qty: it.quantity || 1,
    price: it.payment_amount || it.product_price || it.price || 0,
  }));

  const koStatus = CAFE24_STATUS_KO[String(data.status || '').trim()] || data.status || '확인중';

  await logRequest(supabase, ip, mall_id, 'order');

  return ok({
    found: true, verified: true,
    usage: { today: count + 1, limit },
    order: {
      order_id: data.order_id,
      order_date: String(data.order_date || '').slice(0, 10),
      status: koStatus,
      total_amount: data.total_amount || 0,
      shipping_fee: data.shipping_fee || 0,
      items,
      courier: null,
      tracking_no: null,
    },
  });
};
