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

// ── 프로필(닉네임) 조회 요청 — Profile API V1 ──
// 이 요청의 HTTP 응답 본문에는 {"success":true} 만 오고, 실제 닉네임은 잠시 뒤
// webhook 으로 event:'profile' 이 다시 들어오는 비동기 방식이다.
function profileRequest(user, field = 'nickname') {
  return { event: 'profile', options: { field }, user };
}

// 네이버 톡톡 send API 호출
async function naverSend(brand, payload) {
  const key = await authKeyFor(brand);
  if (!key) {
    console.error('[naver] 발신 인증키 없음 brand=', brand);
    return { ok: false, error: 'no_auth_key' };
  }
  // 보낸 뒤 echo 로 되돌아왔을 때 봇 자신의 메시지임을 알아볼 수 있도록 먼저 기록해 둔다.
  // (전송 후에 기록하면 그 사이 도착한 echo 를 상담원 메시지로 오인할 수 있다)
  if (payload?.user && payload?.textContent?.text) {
    try {
      const { getSupabase } = require('./_chatbot_utils');
      await rememberBotText(getSupabase(), payload.user, payload.textContent.text);
    } catch (e) { console.error('[naver] echo 기록 실패:', e.message); }
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
// 대화 단계(step/data)와 무관한 부가 정보. 단계 전환·초기화 때 지워지지 않게 보존한다.
const STICKY_STATE_KEYS = ['botEcho', 'nickname'];

async function setState(supabase, user, state) {
  let next = state;
  const missing = STICKY_STATE_KEYS.filter((k) => state && state[k] === undefined);
  if (missing.length) {
    const cur = await getState(supabase, user);
    const carry = {};
    missing.forEach((k) => { if (cur && cur[k] !== undefined) carry[k] = cur[k]; });
    if (Object.keys(carry).length) next = { ...state, ...carry };
  }
  await supabase
    .from('chatbot_naver_sessions')
    .upsert({ naver_user: user, state: next, updated_at: new Date().toISOString() }, { onConflict: 'naver_user' });
}
async function clearState(supabase, user) {
  await setState(supabase, user, { step: 'IDLE', data: {} });
}

// ── 봇이 보낸 문구 기억 (echo 판별용) ──
// 톡톡은 봇이 보낸 메시지도 echo 이벤트로 되돌려주기 때문에, 되돌아온 메시지가
// 상담원이 친 것인지 봇 자신의 것인지 가려내야 한다. 예전에는 options.sourceId 로만
// 판별했는데 실제 운영에서 상담원 응대가 한 번도 잡히지 않아(handover 기록 0건),
// 봇이 보낸 문구를 기억해 두고 대조하는 방식으로 바꿨다.
const ECHO_TTL_MS = 30 * 60 * 1000; // 이보다 오래된 기록은 대조하지 않는다
const ECHO_KEEP = 12;               // 최근 몇 건까지 기억할지
const echoKey = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 300);

async function rememberBotText(supabase, user, text) {
  const k = echoKey(text);
  if (!k) return;
  const st = await getState(supabase, user);
  const now = Date.now();
  const kept = (Array.isArray(st.botEcho) ? st.botEcho : [])
    .filter((e) => e && e.k !== k && now - (e.t || 0) < ECHO_TTL_MS);
  await setState(supabase, user, { ...st, botEcho: [{ k, t: now }, ...kept].slice(0, ECHO_KEEP) });
}

async function isOwnBotText(supabase, user, text) {
  const k = echoKey(text);
  if (!k) return false;
  const st = await getState(supabase, user);
  const now = Date.now();
  return (Array.isArray(st.botEcho) ? st.botEcho : []).some((e) => {
    if (!e || !e.k || now - (e.t || 0) >= ECHO_TTL_MS) return false;
    if (e.k === k) return true;
    // 톡톡이 되돌려줄 때 뒷부분(버튼 안내 등)이 달라질 수 있으므로,
    // 충분히 긴 문구는 앞부분만 같아도 같은 메시지로 본다.
    // 못 알아보면 봇이 자기 메시지에 침묵해 버리므로 판정을 느슨하게 둔다.
    return k.length >= 20 && e.k.length >= 20 && e.k.slice(0, 40) === k.slice(0, 40);
  });
}

// ── 톡톡 닉네임 (A/S 접수 시 이름 옆에 함께 남기기 위해 보관) ──
async function setNickname(supabase, user, nickname) {
  const nick = String(nickname || '').trim().slice(0, 40);
  if (!nick) return;
  const st = await getState(supabase, user);
  await setState(supabase, user, { ...st, nickname: nick });
}
async function getNickname(supabase, user) {
  const st = await getState(supabase, user);
  return (st && st.nickname) || '';
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
  passThread, takeThread, profileRequest,
  getState, setState, clearState,
  setNickname, getNickname,
  getHistory, appendHistory, clearHistory,
  getLastActivityAt, touchSession,
  setHandover, isHandover,
  rememberBotText, isOwnBotText,
};
