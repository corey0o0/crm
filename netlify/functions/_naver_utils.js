'use strict';
//
// 네이버 톡톡 챗봇 API 공용 유틸 (send API 어댑터 + 대화상태 저장)
// 공식 API: https://github.com/navertalk/chatbot-api
//
// [필수 환경변수]
//   NAVER_AUTH_NB   : 니어바이크 톡톡 계정 발신 인증키 (ct_...)
//   NAVER_AUTH_XRB  : X-RIDER 톡톡 계정 발신 인증키 (ct_...)
//   URL             : Netlify가 자동 주입하는 사이트 URL (내부 함수 호출용)
//

const SEND_API = 'https://gw.talk.naver.com/chatbot/v1/event';

// 네이버 톡톡이 webhook을 호출하는 출발 IP 대역 (파트너센터 ACL 안내값) — 검증용 참고
const NAVER_ACL_CIDRS = ['211.249.40.0/27', '211.249.68.0/27', '220.230.168.0/27', '103.6.173.0/27'];

// brand → 발신 인증키 (톡톡 계정마다 다름)
function authKeyFor(brand) {
  const map = { nb: process.env.NAVER_AUTH_NB, xrb: process.env.NAVER_AUTH_XRB };
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

// 작성중(typing) 표시 on/off
function typing(user, on) {
  return { event: 'action', user, options: { action: on ? 'typingOn' : 'typingOff' } };
}

// 네이버 톡톡 send API 호출
async function naverSend(brand, payload) {
  const key = authKeyFor(brand);
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

module.exports = {
  SEND_API, NAVER_ACL_CIDRS,
  authKeyFor, textMessage, compositeMessage, typing, naverSend,
  getState, setState, clearState,
};
