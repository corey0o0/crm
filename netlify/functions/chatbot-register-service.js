'use strict';
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight } = require('./_chatbot_utils');
const { getSettings, fireWebhook, serviceBrandOf } = require('./_chatbot_settings');

const R2_BUCKET = 'crm-img';
const getR2PublicUrl = () => process.env.R2_PUBLIC_URL || 'https://pub-27aaa3bc54074d938a076a095676c921.r2.dev';

// 챗봇으로 받은 사진(네이버 CDN, 임시 URL)을 내려받아 R2에 영구 저장하고 service_files에 기록한다.
// 실패해도 A/S 접수 자체는 이미 끝난 상태이므로 접수를 막지 않는다.
async function attachChatbotPhoto(supabase, serviceId, photoUrl) {
  const res = await fetch(photoUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());

  const key = `chatbot/${serviceId}_${Date.now()}.jpg`;
  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  await client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buf, ContentType: contentType }));
  const publicUrl = `${getR2PublicUrl()}/${key}`;

  await supabase.from('service_files').insert({
    service_id: serviceId,
    file_id: key,
    file_name: `챗봇_사진_${serviceId}.jpg`,
    file_size: buf.length,
    file_type: contentType,
    web_view_link: publicUrl,
    web_content_link: publicUrl,
    upload_date: new Date().toISOString(),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'POST만 허용');

  const supabase = getSupabase();
  const ip = getIp(event);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err(400, 'Invalid JSON'); }

  const { name, phone, product_name, symptom, brand, photo_url } = body;
  if (!name || !phone || !product_name || !symptom || !brand) {
    return err(400, 'name, phone, product_name, symptom, brand 필수');
  }

  const { allowed, count, limit } = await checkRateLimit(supabase, ip, 'register');
  if (!allowed) {
    return err(429, `24시간 이내 A/S 접수 한도(${limit}회)를 초과했습니다. 잠시 후 다시 시도해주세요.`);
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

  if (photo_url) {
    try { await attachChatbotPhoto(supabase, data.id, photo_url); }
    catch (e) { console.error('[chatbot-register-service] 사진 첨부 실패:', e.message); }
  }

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
