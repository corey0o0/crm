'use strict';
//
// 챗봇 운영설정(ON/OFF·시간) 공용 헬퍼 — 톡톡 봇/위젯 공통.
// chatbot_settings 테이블(brand PK: NB/NB2/XRB) 기준, KST(UTC+9)로 운영시간 판정.
//

const DEFAULTS = {
  enabled: true,
  naver_enabled: true, // 네이버 톡톡 전용 토글 (마스터 enabled 와 AND)
  hours_start: '09:00',
  hours_end: '18:00',
  days: [1, 2, 3, 4, 5],
  offhours_message: '지금은 AI 상담 시간입니다 🤖\n궁금한 점을 입력해 주시면 바로 답변해 드릴게요.\n보다 자세한 확인이 필요하시면 [A/S 접수]를 이용해 주세요.\n접수 내용은 평일(월~금) 09:00~18:00에 확인 후 순차적으로 연락드리고 있습니다.',
  offhours_image_url: null,
  forbidden_phrases: [], // 답변에서 절대 쓰면 안 되는 표현(관리자 추가)
  naver_auth_key: null,  // 네이버 톡톡 발신 인증키 (브랜드별)
  system_prompt: null,   // 챗봇 기본 시스템 프롬프트 (null이면 코드 하드코딩 사용)
  anthropic_api_key: null, // Anthropic API 키 (공통, NB row에만 저장)
  webhook_url: null,     // 이벤트 외부 전송 웹훅 URL (브랜드별)
};

// chatbot_settings PK (채널 단위)
const dbBrandOf = (brand) => {
  const b = String(brand || '').toLowerCase();
  if (b === 'xrb') return 'XRB';
  if (b === 'nb2') return 'NB2';
  return 'NB';
};

// services / FAQ 등 CRM 데이터 brand (NB | XRB 만 — nb2 는 NB 로 정규화)
const serviceBrandOf = (brand) => {
  const b = String(brand || '').toLowerCase();
  return b === 'xrb' ? 'XRB' : 'NB';
};

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

// 운영시간 외 안내 문구 (설정값 우선, 없으면 기본값)
// 별도 메시지로 보내면 말풍선이 늘어나므로 호출부에서 본문 뒤에 이어붙여 쓴다.
const offhoursText = (s) => (s && s.offhours_message) || DEFAULTS.offhours_message;

// 네이버 톡톡이 활성인지 — 마스터 ON 이면서 톡톡 토글도 ON 일 때만
function isNaverEnabled(s) {
  const set = { ...DEFAULTS, ...(s || {}) };
  return !!set.enabled && set.naver_enabled !== false;
}

// 이벤트 외부 웹훅 전송 (오류 무시, 비동기)
async function fireWebhook(url, payload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[webhook] 전송 실패:', e.message);
  }
}

module.exports = { DEFAULTS, dbBrandOf, serviceBrandOf, getSettings, nowKST, isWithinHours, isNaverEnabled, offhoursText, fireWebhook };
