'use strict';
//
// 네이버 톡톡 webhook 수신 엔드포인트 (동기 진입점)
//
// [파트너센터 등록]
//   이벤트 받을 URL : https://<사이트>/.netlify/functions/chatbot-naver-webhook?brand=nb   (스마트스토어)
//                     https://<사이트>/.netlify/functions/chatbot-naver-webhook?brand=nb2  (공식홈페이지)
//                     https://<사이트>/.netlify/functions/chatbot-naver-webhook?brand=xrb  (X-RIDER)
//   사용 event      : open, send, leave  (echo/friend 미사용)
//
// 네이버 톡톡 webhook은 읽기 타임아웃이 5초라 LLM 응답을 동기로 못 돌린다.
// → 여기서는 즉시 200 ACK만 하고, 무거운 처리(FAQ/LLM/조회)는 백그라운드 함수로 위임한다.
//
const { getSupabase, ok, err } = require('./_chatbot_utils');
const { textMessage, imageMessage, naverSend, setHandover, isHandover } = require('./_naver_utils');
const { getSettings, isWithinHours, isNaverEnabled } = require('./_chatbot_settings');

// OFF/운영시간 외 안내 전송 (텍스트 + 선택 이미지)
async function sendOffNotice(brand, user, s) {
  await naverSend(brand, textMessage(user, s.offhours_message || '지금은 상담 운영시간이 아닙니다. A/S 접수를 남겨주시면 영업시간에 연락드리겠습니다.'));
  if (s.offhours_image_url) await naverSend(brand, imageMessage(user, s.offhours_image_url));
}

// 빠른응답 버튼 — worker(chatbot-naver-worker-background)의 CATEGORIES 코드와 반드시 일치해야 함
const CATEGORIES = [
  { title: '📦 주문·배송', code: 'CAT_ORDER' },
  { title: '🔧 A/S·수리', code: 'CAT_SERVICE' },
  { title: '📖 제품·매뉴얼', code: 'CAT_PRODUCT' },
  { title: '💬 기타 문의', code: 'CAT_OTHER' },
];

function welcomeText(brand) {
  const name = brand === 'xrb' ? 'X-RIDER' : '니어바이크';
  return `${name} 고객센터입니다. 무엇을 도와드릴까요?\n아래 메뉴를 선택하시거나 궁금한 점을 입력해 주세요.\n\n※ AI가 자동으로 답변드려요. 정확한 상담이 필요하면 [A/S·수리] 메뉴를 이용해주세요.`;
}

exports.handler = async (event) => {
  // 등록/헬스체크용 GET → 200 (키 값 비노출, DB/env 유무만)
  if (event.httpMethod === 'GET') {
    const supabase = getSupabase();
    const brands = ['nb', 'nb2', 'xrb'];
    const auth = {};
    for (const b of brands) {
      const s = await getSettings(supabase, b).catch(() => ({}));
      const envMap = { nb: process.env.NAVER_AUTH_NB, nb2: process.env.NAVER_AUTH_NB2, xrb: process.env.NAVER_AUTH_XRB };
      auth[b] = {
        key: !!(s.naver_auth_key || envMap[b]),
        from: s.naver_auth_key ? 'db' : (envMap[b] ? 'env' : 'none'),
        enabled: !!s.enabled,
        naver_enabled: s.naver_enabled !== false,
        active: !!(s.enabled && s.naver_enabled !== false && (s.naver_auth_key || envMap[b])),
      };
    }
    return ok({ ok: true, primary: 'nb2', auth });
  }
  if (event.httpMethod !== 'POST') return err(405, 'POST only');

  const brand = (event.queryStringParameters?.brand || 'nb').toLowerCase();

  // 파싱 실패해도 200으로 ACK (네이버 재전송 폭주 방지)
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return ok({}); }

  const evType = body.event;
  const user = body.user;
  if (!user) return ok({});

  const supabase = getSupabase();
  const settings = await getSettings(supabase, brand);
  const naverOn = isNaverEnabled(settings); // 마스터 ON && 톡톡 토글 ON
  const within = isWithinHours(settings);

  // open: 입장 인사 (OFF면 완전 무응답, 운영시간 외면 인사+안내)
  if (evType === 'open') {
    if (!naverOn) return ok({}); // 톡톡 OFF → 아무것도 보내지 않음(완전 무음)
    await naverSend(brand, textMessage(user, welcomeText(brand), CATEGORIES));
    if (!within) await sendOffNotice(brand, user, settings);
    return ok({});
  }

  // leave: 세션 정리
  if (evType === 'leave') {
    try { await supabase.from('chatbot_naver_sessions').delete().eq('naver_user', user); } catch {}
    return ok({});
  }

  // handover: 제어권 변경 (상담원 인계/복귀)
  if (evType === 'handover') {
    const ctrl = body.options?.control;
    const targetId = body.options?.targetId;
    if (ctrl === 'passThread' && (targetId === 1 || targetId === '1')) {
      // 상담원에게 제어권 넘어감 → 봇 침묵
      try { await setHandover(supabase, user, true); } catch {}
    } else {
      // 봇에게 제어권 복귀(상담원 상담 종료 등) → 봇 재개
      let was = false;
      try { was = await isHandover(supabase, user); await setHandover(supabase, user, false); } catch {}
      if (naverOn && was) {
        await naverSend(brand, textMessage(user, '상담원 상담이 마무리되었어요. 더 궁금한 점이 있으면 편하게 입력해 주세요 🙂'));
      }
    }
    return ok({});
  }

  // send: 사용자 입력(또는 빠른응답 code) → 무거운 처리는 백그라운드로 위임
  if (evType === 'send') {
    // 상담원(운영자)이 수동 응대 중이면(handover standby) 봇은 끼어들지 않음
    if (body.options?.standby || body.standby) return ok({});

    const text = body.textContent?.text || '';
    const code = body.textContent?.code || ''; // 빠른응답/버튼 클릭 시 code 전달
    const hasImage = !!(body.imageContent && (body.imageContent.imageUrl || body.imageContent.url));
    if (!text.trim() && !code && !hasImage) return ok({});

    // 톡톡 OFF면 완전 무응답(아무것도 보내지 않음)
    if (!naverOn) return ok({});

    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
    try {
      // 백그라운드 함수 트리거 — 즉시 202를 받고 반환(네이버 5초 타임아웃 회피)
      await fetch(`${base}/.netlify/functions/chatbot-naver-worker-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, user, text, code, hasImage }),
      });
    } catch (e) {
      console.error('[naver-webhook] worker 트리거 실패:', e.message);
      await naverSend(brand, textMessage(user, '잠시 후 다시 시도해 주세요.'));
    }
    return ok({});
  }

  // friend/echo/action 등 그 외 이벤트는 무시
  return ok({});
};
