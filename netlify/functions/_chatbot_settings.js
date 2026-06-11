'use strict';
//
// 챗봇 운영설정(ON/OFF·시간) 공용 헬퍼 — 톡톡 봇/위젯 공통.
// chatbot_settings 테이블(brand PK: NB/XRB) 기준, KST(UTC+9)로 운영시간 판정.
//

const DEFAULTS = {
  enabled: true,
  hours_start: '09:00',
  hours_end: '18:00',
  days: [1, 2, 3, 4, 5],
  offhours_message: '지금은 상담 운영시간이 아닙니다. A/S 접수를 남겨주시면 영업시간에 순차적으로 연락드리겠습니다.',
  offhours_image_url: null,
};

const dbBrandOf = (brand) => (String(brand || '').toLowerCase() === 'xrb' ? 'XRB' : 'NB');

async function getSettings(supabase, brand) {
  try {
    const { data } = await supabase.from('chatbot_settings').select('*').eq('brand', dbBrandOf(brand)).maybeSingle();
    return { ...DEFAULTS, ...(data || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

// 현재 KST 시각 (요일 0=일~6=토, 분 단위 hm)
function nowKST() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { day: d.getUTCDay(), hm: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const parseHM = (s) => {
  const [h, m] = String(s || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function isWithinHours(s) {
  const set = { ...DEFAULTS, ...(s || {}) };
  const { day, hm } = nowKST();
  const days = Array.isArray(set.days) ? set.days : DEFAULTS.days;
  if (!days.includes(day)) return false;
  const start = parseHM(set.hours_start), end = parseHM(set.hours_end);
  if (start <= end) return hm >= start && hm < end;
  return hm >= start || hm < end; // 자정 넘김
}

module.exports = { DEFAULTS, dbBrandOf, getSettings, nowKST, isWithinHours };
