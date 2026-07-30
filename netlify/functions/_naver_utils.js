'use strict';
//
// 네이버 톡톡 챗봇 API 공용 유틸 (send API 어댑터 + 대화상태 저장)
// 공식 API: https://github.com/navertalk/chatbot-api
//
// [발신 인증키 우선순위] DB chatbot_settings.naver_auth_key → 환경변수 NAVER_AUTH_*
//

const SEND_API = 'https://gw.talk.naver.com/chatbot/v1/event';

// 네이버 톡톡이 webhook을 호출하는 출발 IP 대역 (파트너센터 ACL 안내값) — 검증용 참고
const NAVER_ACL_CIDRS = ['211.249.40.0/27', '211.249.68.0/27', '220.230.168.0/27', '103.6.173.0/27'];

// brand → 발신 인증키: DB 우선, env fallback
async function authKeyFor(brand) {
  try {
    const { getSupabase } = require('./_chatbot_utils');
    const { getSettings } = require('./_chatbot_settings');
    const settings = await getSettings(getSupabase(), brand);
    if (settings.naver_auth_key) return settings.naver_auth_key;
  } catch {}
  const map = { nb: process.env.NAVER_AUTH_NB, nb2: process.env.NAVER_AUTH_NB2, xrb: process.env.NAVER_AUTH_XRB };
  return map[brand] || null;
}

// 텍스트 메시지 (+ 선택적 빠른응답 버튼). quickReplies: [{title, code}]
function textMessage(user, text, quickReplies) {
  const textContent = { text };
  if (quickReplies && quickReplies.length) {
    textContent.quickReply = {
      buttonList: quickReplies.slice(0, 13).map(q => ({
        type: 'TEXT',
        data: { title: q.title, code: q.code || q.title },
      })),
    };
  }
  return { event: 'send', user, textContent };
}

// 카드(이미지+버튼) 메시지. cards: [{title, description, imageUrl, buttons:[{title, code}|{title, url, mobileUrl}]}]
function compositeMessage(user, cards) {
  return {
    event: 'send',
    user,
    compositeContent: {
      compositeList: cards.map(c => ({
        title: c.title,
        description: c.description || '',
        ...(c.imageUrl ? { image: { imageUrl: c.imageUrl } } : {}),
        buttonList: (c.buttons || []).map(b =>
          b.url
            ? { type: 'LINK', data: { title: b.title, url: b.url, mobileUrl: b.mobileUrl || b.url } }
            : { type: 'TEXT', data: { title: b.title, code: b.code || b.title } }
        ),
      })),
    },
  };
}

// 이미지 메시지
function imageMessage(user, imageUrl) {
  return { event: 'send', user, imageContent: { imageUrl } };
}

// 작성중(typing) 표시 on/off
function typing(user, on) {
  return { event: 'action', user, options: { action: on ? 'typingOn' : 'typingOff' } };
}

// ── 핸드오버(상담원 전환) 이벤트 (Handover API V1) ──
// 봇 → 상담원(파트너센터, targetId=1)에게 대화 제어권 넘김
function passThread(user, targetId = 1, metadata) {
  const options = { control: 'passThread', targetId };
  if (metadata) options.metadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  return { event: 'handover', user, options };
}
// 봇이 제어권 회수
function takeThread(user) {
  return { event: 'handover', user, options: { control: 'takeThread', metadata: '' } };
}

// 네이버 톡톡 send API 호출
async function naverSend(brand, payload) {
  const key = await authKeyFor(brand);
  if (!key) {
    console.error('[naver] 발신 인증키 없음 brand=', brand);
    return { ok: false, error: 'no_auth_key' };
  }
  try {
    const res = await fetch(SEND_API, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.success) console.error('[naver] send 실패:', JSON.stringify(data));
    return { ok: !!data.success, data };
  } catch (e) {
    console.error('[naver] send 예외:', e.message);
    return { ok: false, error: e.message };
  }
}

// ── 대화 상태 저장/조회 (Supabase: chatbot_naver_sessions) ──
// step 머신: IDLE / ORDER_NO·ORDER_NAME·ORDER_PHONE / AS_INPUT / REG_NAME·REG_PHONE·REG_PRODUCT·REG_SYMPTOM
async function getState(supabase, user) {
  const { data } = await supabase
    .from('chatbot_naver_sessions')
    .select('state')
    .eq('naver_user', user)
    .maybeSingle();
  return data?.state || { step: 'IDLE', data: {} };
}
async function setState(supabase, user, state) {
  await supabase
    .from('chatbot_naver_sessions')
    .upsert({ naver_user: user, state, updated_at: new Date().toISOString() }, { onConflict: 'naver_user' });
}
async function clearState(supabase, user) {
  await setState(supabase, user, { step: 'IDLE', data: {} });
}

// ── 대화 히스토리 (사람처럼 맥락 유지) — state 와 분리된 history 컬럼 ──
// 플로우 setState 가 덮어쓰지 않도록 별도 컬럼으로 관리. 최근 8턴만 유지.
async function getHistory(supabase, user) {
  const { data } = await supabase
    .from('chatbot_naver_sessions')
    .select('history')
    .eq('naver_user', user)
    .maybeSingle();
  return Array.isArray(data?.history) ? data.history : [];
}
async function appendHistory(supabase, user, turns) {
  const clean = (turns || [])
    .filter((t) => t && t.role && t.content)
    .map((t) => ({ role: t.role, content: String(t.content).slice(0, 600) }));
  if (!clean.length) return;
  const cur = await getHistory(supabase, user);
  const history = [...cur, ...clean].slice(-8);
  await supabase
    .from('chatbot_naver_sessions')
    .upsert({ naver_user: user, history, updated_at: new Date().toISOString() }, { onConflict: 'naver_user' });
}
async function clearHistory(supabase, user) {
  await supabase
    .from('chatbot_naver_sessions')
    .upsert({ naver_user: user, history: [], updated_at: new Date().toISOString() }, { onConflict: 'naver_user' });
}

// ── 마지막 활동 시각 ──
// 톡톡은 채팅창을 닫았다 열 때마다 open 이벤트를 보내므로, 직전까지 대화 중이었다면
// 인사말·메뉴를 다시 보내지 않기 위해 사용한다.
async function getLastActivityAt(supabase, user) {
  const { data } = await supabase
    .from('chatbot_naver_sessions')
    .select('updated_at')
    .eq('naver_user', user)
    .maybeSingle();
  const t = data?.updated_at ? new Date(data.updated_at).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
}

// 메시지를 처리할 때마다 활동 시각만 갱신 (FAQ 버튼처럼 state 를 안 건드리는 경로 대비)
async function touchSession(supabase, user) {
  await supabase
    .from('chatbot_naver_sessions')
    .upsert({ naver_user: user, updated_at: new Date().toISOString() }, { onConflict: 'naver_user' });
}

// ── 핸드오버 상태 플래그 (상담원 응대 중이면 봇 침묵) ──
async function setHandover(supabase, user, on) {
  await supabase
    .from('chatbot_naver_sessions')
    .upsert({ naver_user: user, handover: !!on, updated_at: new Date().toISOString() }, { onConflict: 'naver_user' });
}
async function isHandover(supabase, user) {
  const { data } = await supabase
    .from('chatbot_naver_sessions')
    .select('handover')
    .eq('naver_user', user)
    .maybeSingle();
  return !!data?.handover;
}

module.exports = {
  SEND_API, NAVER_ACL_CIDRS,
  authKeyFor, textMessage, compositeMessage, imageMessage, typing, naverSend,
  passThread, takeThread,
  getState, setState, clearState,
  getHistory, appendHistory, clearHistory,
  getLastActivityAt, touchSession,
  setHandover, isHandover,
};
