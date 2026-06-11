'use strict';
//
// 네이버 톡톡 webhook 수신 엔드포인트 (동기 진입점)
//
// [파트너센터 등록]
//   이벤트 받을 URL : https://<사이트>/.netlify/functions/chatbot-naver-webhook?brand=nb
//                     (X-RIDER 계정은 ?brand=xrb)
//   사용 event      : open, send, leave  (echo/friend 미사용)
//
// 네이버 톡톡 webhook은 읽기 타임아웃이 5초라 LLM 응답을 동기로 못 돌린다.
// → 여기서는 즉시 200 ACK만 하고, 무거운 처리(FAQ/LLM/조회)는 백그라운드 함수로 위임한다.
//
const { getSupabase, ok, err } = require('./_chatbot_utils');
const { textMessage, naverSend } = require('./_naver_utils');

// 위젯의 4개 카테고리 → 빠른응답 버튼
const CATEGORIES = [
  { title: '🛒 주문/배송 조회', code: 'CAT_ORDER' },
  { title: '🔧 A/S 조회·접수', code: 'CAT_AS' },
  { title: '❓ 자주 묻는 질문', code: 'CAT_FAQ' },
  { title: '💬 상담원 연결', code: 'CAT_AGENT' },
];

function welcomeText(brand) {
  const name = brand === 'xrb' ? 'X-RIDER' : '니어바이크';
  return `${name} 고객센터입니다. 무엇을 도와드릴까요?\n아래 메뉴를 선택하시거나 궁금한 점을 입력해 주세요.`;
}

exports.handler = async (event) => {
  // 등록/헬스체크용 GET → 200 (env 설정 여부만 불리언으로 노출, 값은 비노출)
  if (event.httpMethod === 'GET') {
    return ok({ ok: true, auth: { nb: !!process.env.NAVER_AUTH_NB, xrb: !!process.env.NAVER_AUTH_XRB } });
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

  // open: 입장 인사 + 카테고리 (빠르므로 인라인 push)
  if (evType === 'open') {
    await naverSend(brand, textMessage(user, welcomeText(brand), CATEGORIES));
    return ok({});
  }

  // leave: 세션 정리
  if (evType === 'leave') {
    try { await supabase.from('chatbot_naver_sessions').delete().eq('naver_user', user); } catch {}
    return ok({});
  }

  // send: 사용자 입력(또는 빠른응답 code) → 무거운 처리는 백그라운드로 위임
  if (evType === 'send') {
    const text = body.textContent?.text || '';
    const code = body.textContent?.code || ''; // 빠른응답/버튼 클릭 시 code 전달
    if (!text.trim() && !code) return ok({});

    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
    try {
      // 백그라운드 함수 트리거 — 즉시 202를 받고 반환(네이버 5초 타임아웃 회피)
      await fetch(`${base}/.netlify/functions/chatbot-naver-worker-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, user, text, code }),
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
