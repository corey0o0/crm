'use strict';
const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// 타입별 허용 횟수 (최근 24시간 기준 슬라이딩 윈도우)
const DAILY_LIMITS = { order: 30, service: 30, chat: 30, register: 5 };

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

function getIp(event) {
  return (
    event.headers['client-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'
  );
}

async function checkRateLimit(supabase, ip, type) {
  const limit = DAILY_LIMITS[type] || 10;
  const since = new Date(Date.now() - 86400 * 1000).toISOString();
  const { count } = await supabase
    .from('chatbot_logs')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('type', type)
    .gte('created_at', since);
  return { allowed: count < limit, count, limit };
}

async function logRequest(supabase, ip, brand, type) {
  await supabase.from('chatbot_logs').insert({ ip, brand, type });
}

function getNaverUserIdFromLog(payload) {
  const explicit = String(payload?.naver_user_id || '').trim();
  if (explicit) return explicit;

  const sessionId = String(payload?.session_id || '');
  return sessionId.startsWith('naver:') ? sessionId.slice('naver:'.length) : null;
}

async function insertChatLog(supabase, payload) {
  const nextPayload = { ...payload };
  const naverUserId = getNaverUserIdFromLog(nextPayload);
  if (naverUserId) nextPayload.naver_user_id = naverUserId;

  const { error } = await supabase.from('chat_logs').insert(nextPayload);
  if (!error) return { error: null };

  // 통계/네이버ID 컬럼 마이그레이션 전 배포도 대화는 계속 기록되어야 한다.
  const msg = `${error.code || ''} ${error.message || ''}`;
  if (!/response_ms|handoff_requested|handoff_executed|naver_user_id|PGRST204/i.test(msg)) return { error };

  const fallback = { ...nextPayload };
  delete fallback.response_ms;
  delete fallback.handoff_requested;
  delete fallback.handoff_executed;
  delete fallback.naver_user_id;
  return supabase.from('chat_logs').insert(fallback);
}

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}
function err(statusCode, message) {
  return { statusCode, headers: CORS, body: JSON.stringify({ error: message }) };
}
function preflight() {
  return { statusCode: 200, headers: CORS, body: '' };
}

module.exports = { CORS, getSupabase, getIp, checkRateLimit, logRequest, insertChatLog, getNaverUserIdFromLog, ok, err, preflight };
