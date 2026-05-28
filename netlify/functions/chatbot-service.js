'use strict';
const { getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight } = require('./_chatbot_utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const supabase = getSupabase();
  const ip = getIp(event);
  const { input, brand } = event.queryStringParameters || {};

  if (!input || !brand) return err(400, 'input, brand 필수');

  const { allowed, count, limit } = await checkRateLimit(supabase, ip, 'service');
  if (!allowed) {
    return err(429, `일일 A/S 조회 한도(${limit}회)를 초과했습니다. 내일 다시 시도해주세요.`);
  }

  const clean = input.trim().replace(/-/g, '');
  let row = null;

  if (/^\d+$/.test(clean)) {
    const { data } = await supabase
      .from('services')
      .select('id, customer_name, customer_phone, product_name, symptom, status, reception_date, completion_date')
      .eq('id', parseInt(clean, 10))
      .eq('brand', brand.toUpperCase())
      .maybeSingle();
    row = data;
  }

  if (!row) {
    const { data: rows } = await supabase
      .from('services')
      .select('id, customer_name, customer_phone, product_name, symptom, status, reception_date, completion_date')
      .eq('brand', brand.toUpperCase())
      .ilike('customer_phone', `%${clean}%`)
      .order('id', { ascending: false })
      .limit(1);
    row = rows?.[0] || null;
  }

  if (!row) return ok({ found: false });

  await logRequest(supabase, ip, brand, 'service');

  return ok({
    found: true,
    usage: { today: count + 1, limit },
    service: {
      id: row.id,
      product_name: row.product_name,
      symptom: row.symptom,
      status: row.status,
      reception_date: String(row.reception_date || '').slice(0, 10),
      est_completion: row.completion_date ? String(row.completion_date).slice(0, 10) : null,
    },
  });
};
