'use strict';
const { getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight } = require('./_chatbot_utils');
const { getSettings, fireWebhook, serviceBrandOf } = require('./_chatbot_settings');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'POST만 허용');

  const supabase = getSupabase();
  const ip = getIp(event);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err(400, 'Invalid JSON'); }

  const { name, phone, product_name, symptom, brand } = body;
  if (!name || !phone || !product_name || !symptom || !brand) {
    return err(400, 'name, phone, product_name, symptom, brand 필수');
  }

  const { allowed, count, limit } = await checkRateLimit(supabase, ip, 'register');
  if (!allowed) {
    return err(429, `일일 A/S 접수 한도(${limit}회)를 초과했습니다. 내일 다시 시도해주세요.`);
  }

  // nb2 → NB (services 테이블은 NB/XRB 만 사용)
  const serviceBrand = serviceBrandOf(brand);

  const now = new Date();
  const kstIso = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00');

  const { data, error } = await supabase
    .from('services')
    .insert({
      brand: serviceBrand,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      product_name: product_name.trim(),
      symptom: `[챗봇 접수] ${symptom.trim()}`,
      status: '준비중',
      reception_type: '기타',
      writer: '챗봇',
      reception_date: kstIso,
      updated_at: now.toISOString(),
    })
    .select('id')
    .single();

  if (error) return err(500, error.message);

  await logRequest(supabase, ip, brand, 'register');

  // 웹훅 전송 (설정된 경우) — 채널 설정은 brand(nb2) 기준
  const settings = await getSettings(supabase, brand).catch(() => ({}));
  if (settings.webhook_url) {
    fireWebhook(settings.webhook_url, {
      event: 'as_registered',
      brand: serviceBrand,
      channel: String(brand).toLowerCase(),
      service_id: data.id,
      name: name.trim(),
      phone: phone.trim(),
      product_name: product_name.trim(),
      symptom: symptom.trim(),
      registered_at: kstIso,
    });
  }

  return ok({ success: true, service_id: data.id });
};
