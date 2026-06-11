'use strict';
// 챗봇 운영설정 공개 조회 (웹 위젯용). GET ?brand=nb
const { getSupabase, ok, err, preflight } = require('./_chatbot_utils');
const { getSettings, isWithinHours } = require('./_chatbot_settings');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return err(405, 'GET only');

  const brand = (event.queryStringParameters?.brand || 'nb').toLowerCase();
  const supabase = getSupabase();
  const s = await getSettings(supabase, brand);

  return ok({
    enabled: !!s.enabled,
    withinHours: isWithinHours(s),
    offhours_message: s.offhours_message || '',
    offhours_image_url: s.offhours_image_url || null,
  });
};
