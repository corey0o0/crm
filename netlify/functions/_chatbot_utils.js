'use strict';
const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// 타입별 일일 허용 횟수
const DAILY_LIMITS = { order: 30, service: 30, chat: 15 };

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

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}
function err(statusCode, message) {
  return { statusCode, headers: CORS, body: JSON.stringify({ error: message }) };
}
function preflight() {
  return { statusCode: 200, headers: CORS, body: '' };
}

module.exports = { CORS, getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight };
