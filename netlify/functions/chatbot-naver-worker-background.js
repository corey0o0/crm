'use strict';
//
// 네이버 톡톡 백그라운드 워커 (*-background.js → Netlify 비동기, 최대 15분)
// 위젯(public/chatbot.js) processInput() 흐름을 그대로 미러링 + send API로 push.
// 비즈니스 로직(주문/AS/등록)은 기존 함수 내부 HTTP 재사용, 대화 두뇌는 _chatbot_brain.
//
const { getSupabase, checkRateLimit, logRequest } = require('./_chatbot_utils');
const { textMessage, naverSend, typing, getState, setState, clearState } = require('./_naver_utils');
const brain = require('./_chatbot_brain');

const base = () => process.env.URL || process.env.DEPLOY_PRIME_URL || '';

// ── 빠른응답 메뉴 ──
const CATEGORIES = [
  { title: '📦 주문·배송', code: 'CAT_ORDER' },
  { title: '🔧 A/S·수리', code: 'CAT_SERVICE' },
  { title: '📖 제품·매뉴얼', code: 'CAT_PRODUCT' },
  { title: '💬 기타 문의', code: 'CAT_OTHER' },
];
const SUB = {
  CAT_ORDER: [
    { title: '📦 주문 조회', code: 'FLOW_ORDER' },
    { title: '🚚 배송 문의', code: '배송' },
    { title: '↩️ 반품/교환', code: '반품 교환' },
  ],
  CAT_SERVICE: [
    { title: '🔧 A/S 현황', code: 'FLOW_AS_LOOKUP' },
    { title: '📝 A/S 접수', code: 'FLOW_AS_REGISTER' },
    { title: '🛡 보증 안내', code: '보증기간 보증부품' },
    { title: '❗ 오류코드', code: '오류코드 에러코드' },
  ],
  CAT_PRODUCT: [
    { title: '📐 모델 제원', code: '모델 제원 스펙 무게 속도' },
    { title: '⚡ PAS 단계', code: 'PAS 단계 속도' },
    { title: '🔋 배터리·충전', code: '배터리 충전방법' },
  ],
};
const POST_MENU = [
  { title: '📝 A/S 접수', code: 'FLOW_AS_REGISTER' },
  { title: '🔧 A/S 현황', code: 'FLOW_AS_LOOKUP' },
  { title: '🏠 처음으로', code: 'RESTART' },
];

const CONTROL = new Set([
  'RESTART', 'AGENT', 'CAT_ORDER', 'CAT_SERVICE', 'CAT_PRODUCT', 'CAT_OTHER',
  'FLOW_ORDER', 'FLOW_AS_LOOKUP', 'FLOW_AS_REGISTER',
]);
const isControl = (c) => CONTROL.has(c) || c.startsWith('FAQ::') || c.startsWith('REGION::');

function welcomeText(brand) {
  const m = brain.BRAND_META[brand] || brain.BRAND_META.nb;
  return `${m.name} 고객센터입니다 ${m.avatar}\n무엇을 도와드릴까요? 아래 메뉴를 선택하시거나 궁금한 점을 입력해 주세요.`;
}

// 내부 함수 호출 (네이버 user를 ip 자리에 → 사용자별 rate limit)
async function callFn(path, { method = 'GET', query = {}, body, user } = {}) {
  const qs = new URLSearchParams(query).toString();
  const url = `${base()}/.netlify/functions/${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `naver:${user}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json().catch(() => ({}));
}

async function loadFaqs(supabase, brand) {
  const { data } = await supabase.from('faq_items')
    .select('label, keywords, answer')
    .in('brand', ['SHARED', (brain.BRAND_META[brand] || {}).dbBrand || 'NB'])
    .eq('is_active', true);
  return data || [];
}

// smart LLM (기존 chatbot-chat smart 모드 재사용: FAQ 분류 우선 → 답변)
async function smartLlm(brand, message, faqs, user) {
  const labels = faqs.filter((f) => f.label).map((f) => f.label);
  const res = await callFn('chatbot-chat', {
    method: 'POST', user,
    body: { mode: 'smart', message, labels, brand, session_id: `naver:${user}` },
  });
  if (res && res.type === 'faq' && res.label) {
    const hit = faqs.find((f) => f.label === res.label);
    if (hit) return { answer: hit.answer };
  }
  return { answer: (res && res.reply) || '잠시 후 다시 시도해 주세요.' };
}

const send = (brand, user, text, quick) => naverSend(brand, textMessage(user, text, quick));
async function done(brand, user, text, quick) {
  await naverSend(brand, typing(user, false));
  await send(brand, user, text, quick);
  return { statusCode: 200, body: '' };
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 200, body: '' }; }
  const { brand = 'nb', user, text = '', code = '' } = body;
  if (!user) return { statusCode: 200, body: '' };

  const supabase = getSupabase();
  await naverSend(brand, typing(user, true));

  // 빠른응답 코드가 control이면 그대로, 아니면 사용자 텍스트로 취급
  const input = (code && !isControl(code)) ? code : String(text || '').trim();
  const state = await getState(supabase, user);

  try {
    // ── 1) 컨트롤 코드 라우팅 ──
    if (code === 'RESTART') { await clearState(supabase, user); return done(brand, user, welcomeText(brand), CATEGORIES); }
    if (code === 'AGENT') {
      // TODO: handover_v1 프로토콜 연동 (파트너센터 상담직원 모드)
      await clearState(supabase, user);
      return done(brand, user, '상담원 연결을 요청했습니다. 평일 09:00~18:00에 순차적으로 답변드립니다.');
    }
    if (code === 'CAT_OTHER') return done(brand, user, '궁금하신 내용을 자유롭게 입력해 주세요. 담당 AI가 도와드리겠습니다 😊');
    if (SUB[code]) return done(brand, user, '아래에서 선택하시거나 직접 입력해 주세요.', SUB[code]);
    if (code === 'FLOW_ORDER') { await setState(supabase, user, { step: 'ORDER_NO', data: {} }); return done(brand, user, '주문번호를 입력해 주세요. (예: 20260522-0000023)'); }
    if (code === 'FLOW_AS_LOOKUP') { await setState(supabase, user, { step: 'AS_INPUT', data: {} }); return done(brand, user, 'A/S 접수번호 또는 연락처를 입력해 주세요.'); }
    if (code === 'FLOW_AS_REGISTER') { await setState(supabase, user, { step: 'REG_NAME', data: {} }); return done(brand, user, 'A/S 접수를 시작합니다 📝\n성함을 입력해 주세요.'); }
    if (code.startsWith('REGION::')) {
      const region = code.slice(8);
      return done(brand, user, brain.buildDealerList(region), [{ title: '↩️ 다른 지역', code: 'CAT_OTHER' }, { title: '🏠 처음으로', code: 'RESTART' }]);
    }
    if (code.startsWith('FAQ::')) {
      const label = code.slice(5);
      const faqs = await loadFaqs(supabase, brand);
      const hit = faqs.find((f) => f.label === label);
      if (hit) return done(brand, user, hit.answer, POST_MENU);
    }

    if (!input) return done(brand, user, welcomeText(brand), CATEGORIES);

    // ── 2) 감정 신호 → 상담원 이관 ──
    if (brain.detectEscalation(input)) {
      await clearState(supabase, user);
      return done(brand, user, '불편을 드려 정말 죄송합니다 😔\n담당자가 직접 도와드리겠습니다. 고객센터(평일 09:00~18:00)로 연락주시면 신속히 처리해 드립니다.');
    }
    // ── 2-1) 진행 중 취소 ──
    if (state.step !== 'IDLE' && brain.isCancel(input)) {
      await clearState(supabase, user);
      return done(brand, user, '취소했습니다. 처음으로 돌아갈게요 😊', CATEGORIES);
    }

    // ── 3) 진행 중 대화상태 ──
    if (state.step !== 'IDLE') {
      const r = await handleFlow(supabase, brand, user, input, state);
      if (r) return r;
    }

    // ── 4) 인텐트 감지 (자유 입력 → 플로우 진입) ──
    if (brain.detectOrder(input)) { await setState(supabase, user, { step: 'ORDER_NO', data: {} }); return done(brand, user, '주문 조회를 도와드리겠습니다 📦\n주문번호를 입력해 주세요. (예: 20260522-0000023)'); }
    if (brain.detectService(input)) { await setState(supabase, user, { step: 'AS_INPUT', data: {} }); return done(brand, user, 'A/S 접수 현황을 확인해드리겠습니다 🔧\nA/S 접수번호 또는 연락처를 입력해 주세요.'); }
    if (brain.detectDealer(input)) {
      if (brand === 'nb') {
        const chips = brain.dealerRegions().map((r) => ({ title: `🗺️ ${r}`, code: `REGION::${r}` }));
        return done(brand, user, '가까운 대리점을 찾아드릴게요 🗺️\n지역을 선택해 주세요.', chips.slice(0, 13));
      }
      const d = brain.DEALER_INFO[brand];
      return done(brand, user, `가까운 판매점 안내 🗺️\n• ${d.linkLabel}\n${d.link}\n(${d.regions})`, [{ title: '🏠 처음으로', code: 'RESTART' }]);
    }
    if (brain.detectTire(input)) {
      await setState(supabase, user, { step: 'TIRE_MODEL', data: {} });
      return done(brand, user, `타이어(튜브) 교체를 도와드릴게요 🔧\n사용 중인 모델명을 알려주세요.\n${brand === 'xrb' ? '(예: X200 MAX SL / X50 FS)' : '(예: 블레이드FS / 카고)'}`);
    }

    // ── 5) 인사 ──
    if (brain.isGreeting(input)) return done(brand, user, welcomeText(brand), CATEGORIES);

    // ── 6) FAQ 매칭 (다중 키워드 스코어링) ──
    const faqs = await loadFaqs(supabase, brand);
    const matched = brain.matchFaqs(faqs, input);
    if (matched.length === 1) {
      try { await supabase.from('chat_logs').insert({ session_id: `naver:${user}`, brand, user_message: input, bot_reply: null, matched_faq_label: matched[0].label, reply_type: 'faq' }); } catch {}
      return done(brand, user, matched[0].answer, POST_MENU);
    }
    if (matched.length > 1) {
      const chips = matched.map((f) => ({ title: f.label, code: `FAQ::${f.label}` }));
      chips.push({ title: '🏠 처음으로', code: 'RESTART' });
      return done(brand, user, '관련 항목을 찾았어요. 궁금한 내용을 선택해 주세요 😊', chips.slice(0, 13));
    }

    // ── 7) LLM smart 폴백 (FAQ 분류 우선) ──
    const { allowed, limit } = await checkRateLimit(supabase, `naver:${user}`, 'chat');
    if (!allowed) return done(brand, user, `오늘 AI 응답 한도(${limit}회)를 초과했습니다.\n평일 09:00~18:00 고객센터로 문의해 주세요.`, POST_MENU);
    const { answer } = await smartLlm(brand, input, faqs, user);
    await logRequest(supabase, `naver:${user}`, brand, 'chat');
    return done(brand, user, answer, POST_MENU);
  } catch (e) {
    console.error('[naver-worker] 예외:', e.message);
    return done(brand, user, '죄송합니다, 잠시 후 다시 시도해 주세요.\n고객센터: 평일 09:00~18:00');
  }
};

// 다단계 대화 처리
async function handleFlow(supabase, brand, user, input, state) {
  const d = state.data || {};
  const mallId = (brain.BRAND_META[brand] || {}).mallId;

  switch (state.step) {
    // 주문 조회
    case 'ORDER_NO':
      d.order_id = input; await setState(supabase, user, { step: 'ORDER_NAME', data: d });
      return done(brand, user, '주문자 성함을 입력해 주세요.');
    case 'ORDER_NAME':
      d.buyer_name = input; await setState(supabase, user, { step: 'ORDER_PHONE', data: d });
      return done(brand, user, '연락처 뒤 4자리를 입력해 주세요.');
    case 'ORDER_PHONE': {
      d.phone_last4 = input.replace(/\D/g, '').slice(-4); await clearState(supabase, user);
      const res = await callFn('chatbot-order', { user, query: { order_id: d.order_id, buyer_name: d.buyer_name, phone_last4: d.phone_last4, mall_id: mallId } });
      if (!res.found) return done(brand, user, '해당 주문을 찾지 못했습니다. 주문번호를 다시 확인해 주세요.', POST_MENU);
      if (!res.verified) return done(brand, user, '주문자 정보가 일치하지 않습니다. 성함/연락처를 다시 확인해 주세요.', POST_MENU);
      const o = res.order;
      const items = (o.items || []).map((i) => `· ${i.name} x${i.qty}`).join('\n');
      return done(brand, user, `📦 주문 ${o.order_id}\n상태: ${o.status}\n주문일: ${o.order_date}\n결제금액: ${Number(o.total_amount).toLocaleString()}원\n\n${items}`, POST_MENU);
    }
    // A/S 조회
    case 'AS_INPUT': {
      await clearState(supabase, user);
      const res = await callFn('chatbot-service', { user, query: { input, brand } });
      if (!res.found) return done(brand, user, '해당 A/S 내역을 찾지 못했습니다. 접수번호/연락처를 확인해 주세요.', POST_MENU);
      const s = res.service;
      return done(brand, user, `🔧 A/S #${s.id}\n제품: ${s.product_name}\n증상: ${s.symptom}\n상태: ${s.status}\n접수일: ${s.reception_date}${s.est_completion ? `\n완료(예정): ${s.est_completion}` : ''}`, POST_MENU);
    }
    // A/S 접수
    case 'REG_NAME':
      d.name = input; await setState(supabase, user, { step: 'REG_PHONE', data: d });
      return done(brand, user, '연락처를 입력해 주세요. (예: 010-1234-5678)');
    case 'REG_PHONE':
      d.phone = input; await setState(supabase, user, { step: 'REG_PRODUCT', data: d });
      return done(brand, user, '제품명(모델명)을 입력해 주세요.');
    case 'REG_PRODUCT':
      d.product_name = input; await setState(supabase, user, { step: 'REG_SYMPTOM', data: d });
      return done(brand, user, '증상을 간단히 입력해 주세요.');
    case 'REG_SYMPTOM': {
      d.symptom = input; await clearState(supabase, user);
      const res = await callFn('chatbot-register-service', { method: 'POST', user, body: { name: d.name, phone: d.phone, product_name: d.product_name, symptom: d.symptom, brand } });
      if (!res.success) return done(brand, user, `접수 중 오류가 발생했습니다: ${res.error || '잠시 후 다시 시도'}`, POST_MENU);
      return done(brand, user, `✅ A/S 접수 완료\n접수번호: ${res.service_id}\n담당자 확인 후 연락드리겠습니다.`, POST_MENU);
    }
    // 타이어 모델
    case 'TIRE_MODEL':
      await clearState(supabase, user);
      return done(brand, user, brain.buildTireAnswer(brand, input), POST_MENU);
    default:
      return null;
  }
}
