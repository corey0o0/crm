'use strict';
//
// 네이버 톡톡 백그라운드 워커 (*-background.js → Netlify 비동기, 최대 15분)
// 위젯(public/chatbot.js) processInput() 흐름을 그대로 미러링 + send API로 push.
// 비즈니스 로직(주문/AS/등록)은 기존 함수 내부 HTTP 재사용, 대화 두뇌는 _chatbot_brain.
//
const { getSupabase, checkRateLimit, logRequest } = require('./_chatbot_utils');
const { textMessage, naverSend, typing, getState, setState, clearState, getHistory, appendHistory, clearHistory, passThread, takeThread, setHandover, isHandover, touchSession } = require('./_naver_utils');
const brain = require('./_chatbot_brain');

const base = () => process.env.URL || process.env.DEPLOY_PRIME_URL || '';

// ── 빠른응답 메뉴 ──
const CATEGORIES = [
  { title: '📦 주문·배송', code: 'CAT_ORDER' },
  { title: '🔧 A/S 접수', code: 'CAT_SERVICE' },
  { title: '📖 제품·매뉴얼', code: 'CAT_PRODUCT' },
  { title: '💬 기타 문의', code: 'CAT_OTHER' },
];
const SUB = {
  CAT_ORDER: [
    { title: '📦 주문 조회', code: 'FLOW_ORDER' },
    { title: '🚚 배송 문의', code: '배송' },
    { title: '↩️ 반품/교환', code: '반품 교환' },
  ],
  CAT_PRODUCT: [
    { title: '📐 모델 제원', code: '모델 제원 스펙 무게 속도' },
    { title: '⚡ PAS 단계', code: 'PAS 단계 속도' },
    { title: '🔋 배터리·충전', code: '배터리 충전방법' },
  ],
};
const POST_MENU = [
  { title: '📝 A/S 접수', code: 'FLOW_AS_REGISTER' },
  { title: '🏠 처음으로', code: 'RESTART' },
];

// 입력을 받는 단계에서 항상 함께 보내는 이동 버튼
const NAV = [
  { title: '◀️ 뒤로가기', code: 'BACK' },
  { title: '🏠 처음으로', code: 'RESTART' },
];

// 단계별 질문 문구 (뒤로가기로 되돌아올 때 그대로 재사용)
const STEP_PROMPT = {
  ORDER_NO:    () => '주문번호를 입력해 주세요. (예: 20260522-0000023)',
  ORDER_NAME:  () => '주문자 성함을 입력해 주세요.',
  ORDER_PHONE: () => '연락처 뒤 4자리를 입력해 주세요.',
  AS_INPUT:    () => 'A/S 접수번호 또는 연락처를 입력해 주세요.',
  REG_NAME:    () => 'A/S 접수를 시작합니다 📝\n성함을 입력해 주세요.',
  REG_PHONE:   () => '연락처를 입력해 주세요. (예: 010-1234-5678)',
  REG_PRODUCT: () => '제품명(모델명)을 입력해 주세요.',
  REG_SYMPTOM: () => '증상을 간단히 입력해 주세요.',
  TIRE_MODEL:  (brand) => `타이어(튜브) 교체를 도와드릴게요 🔧\n사용 중인 모델명을 알려주세요.\n${brand === 'xrb' ? '(예: X200 MAX SL / X50 FS)' : '(예: 블레이드FS / 카고)'}`,
};

// 뒤로가기 시 되돌아갈 이전 단계 (입력했던 값은 유지)
const PREV_STEP = {
  ORDER_NAME:  'ORDER_NO',
  ORDER_PHONE: 'ORDER_NAME',
  REG_PHONE:   'REG_NAME',
  REG_PRODUCT: 'REG_PHONE',
  REG_SYMPTOM: 'REG_PRODUCT',
};

// 플로우 첫 단계에서 뒤로가기 → 진입 전 화면으로 (없으면 메인 메뉴)
const FIRST_STEP_PARENT = { ORDER_NO: 'CAT_ORDER' };

const CONTROL = new Set([
  'RESTART', 'BACK', 'AGENT', 'CAT_ORDER', 'CAT_SERVICE', 'CAT_PRODUCT', 'CAT_OTHER',
  'FLOW_ORDER', 'FLOW_AS_LOOKUP', 'FLOW_AS_REGISTER',
]);
const isControl = (c) => CONTROL.has(c) || c.startsWith('CAT_') || c.startsWith('FLOW_') || c.startsWith('FAQ::') || c.startsWith('REGION::');

function welcomeText(brand) {
  const m = brain.BRAND_META[brand] || brain.BRAND_META.nb;
  return `${m.name} 고객센터입니다 ${m.avatar}\n무엇을 도와드릴까요? 아래 메뉴를 선택하시거나 궁금한 점을 입력해 주세요.\n\n※ AI가 자동으로 답변드려요. 정확한 상담이 필요하면 [A/S 접수] 메뉴를 이용해주세요.`;
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
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('faq_items')
    .select('label, keywords, answer, is_announcement')
    .in('brand', ['SHARED', (brain.BRAND_META[brand] || {}).dbBrand || 'NB'])
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    // id 까지 정렬해 순서를 고정한다 — 지식 문자열이 매번 같아야 프롬프트 캐시가 적중한다
    .order('is_announcement', { ascending: false })
    .order('id', { ascending: true });
  return data || [];
}

// RAG LLM — FAQ 전체를 지식으로 주고, 사람 상담원처럼 맥락(history) 이어 자연스럽게 답변
async function ragLlm(brand, message, faqs, user, history) {
  const knowledge = faqs
    .filter((f) => f.label && f.answer)
    .map((f) => `### ${f.is_announcement ? '[공지] ' : ''}${f.label}\n${f.answer}`)
    .join('\n\n');
  const res = await callFn('chatbot-chat', {
    method: 'POST', user,
    body: { mode: 'rag', message, brand, knowledge, history, session_id: `naver:${user}` },
  });
  return (res && res.reply) || '죄송해요, 잠시 후 다시 시도해 주세요. 계속 안 되면 아래 [A/S 접수]를 남겨주시면 담당자가 확인해 드릴게요.';
}

const send = (brand, user, text, quick) => naverSend(brand, textMessage(user, text, quick));
async function done(brand, user, text, quick) {
  await naverSend(brand, typing(user, false));
  await send(brand, user, text, quick);
  return { statusCode: 200, body: '' };
}

// 특정 단계로 이동하며 그 단계의 질문을 보낸다 (뒤로가기/처음으로 버튼 포함).
// data 를 넘기면 지금까지 입력한 값을 유지한 채 단계만 바꾼다.
async function askStep(supabase, brand, user, step, data = {}, prefix) {
  await setState(supabase, user, { step, data });
  const text = STEP_PROMPT[step](brand);
  return done(brand, user, prefix ? `${prefix}\n${text}` : text, NAV);
}

// 상담원 연결 요청 감지 (명시적 표현만)
const wantsAgent = (s) => /(상담원|상담사|상담직원|채팅상담)/.test(s) || /(직원|담당자|사람)\s*(이?랑|하고|한테|와|과)?\s*(연결|통화|상담|바꿔|불러)/.test(s);

// 상담원에게 인계(passThread) — 안내 후 제어권을 파트너센터 상담원(targetId=1)에게 넘김
async function goAgent(supabase, brand, user) {
  await clearState(supabase, user);
  await naverSend(brand, typing(user, false));
  await send(brand, user, '상담원에게 연결해 드릴게요 🙂\n잠시만 기다려 주시면 순차적으로 답변드립니다. (연결 중에는 챗봇이 응답하지 않아요)');
  await setHandover(supabase, user, true);
  await naverSend(brand, passThread(user, 1));
  return { statusCode: 200, body: '' };
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 200, body: '' }; }
  const { brand = 'nb', user, text = '', hasImage = false } = body;
  let code = body.code || '';
  if (!user) return { statusCode: 200, body: '' };

  const supabase = getSupabase();

  // 상담원 응대 중(handover)이면 봇은 침묵 — '처음으로(RESTART)'로만 챗봇 회수
  if (await isHandover(supabase, user)) {
    if (code !== 'RESTART') return { statusCode: 200, body: '' };
    await setHandover(supabase, user, false);
    await naverSend(brand, takeThread(user));
  }

  // 활동 시각 갱신 — open 이벤트에서 인사말 재전송 여부를 판단하는 기준
  await touchSession(supabase, user).catch(() => {});

  await naverSend(brand, typing(user, true));

  // 사진 수신 — 봇은 이미지를 볼 수 없으므로 추측 답변 대신 A/S 접수로 유도
  if (hasImage) {
    return done(brand, user, '사진 잘 받았습니다 📷\n사진만으로는 정확한 진단이 어려워, 아래 [A/S 접수]를 남겨주시면 담당자가 사진과 함께 확인해 정확히 안내해 드릴게요.', POST_MENU);
  }

  // 레거시/혼선 코드 정규화 (옛 환영메뉴 코드 호환: CAT_AS/CAT_FAQ/CAT_AGENT)
  if (code === 'CAT_AS') code = 'CAT_SERVICE';
  else if (code === 'CAT_AGENT') code = 'AGENT';
  else if (code === 'CAT_FAQ') code = 'CAT_OTHER';

  // 빠른응답 코드가 control이면 그대로, 아니면 사용자 텍스트로 취급
  const input = (code && !isControl(code)) ? code : String(text || '').trim();
  const state = await getState(supabase, user);

  try {
    // ── 1) 컨트롤 코드 라우팅 ──
    if (code === 'RESTART') { await clearState(supabase, user); await clearHistory(supabase, user); return done(brand, user, welcomeText(brand), CATEGORIES); }
    if (code === 'BACK') {
      const prev = PREV_STEP[state.step];
      // 이전 입력 단계가 있으면 값을 유지한 채 그 단계로 되돌아간다
      if (prev) return askStep(supabase, brand, user, prev, state.data || {});
      // 플로우 첫 단계이거나 진행 중이 아니면 진입 전 화면(없으면 메인 메뉴)으로
      await clearState(supabase, user);
      const parent = FIRST_STEP_PARENT[state.step];
      if (parent && SUB[parent]) return done(brand, user, '아래에서 선택하시거나 직접 입력해 주세요.', SUB[parent]);
      return done(brand, user, welcomeText(brand), CATEGORIES);
    }
    if (code === 'AGENT') return goAgent(supabase, brand, user);
    if (code === 'CAT_OTHER') return done(brand, user, '궁금하신 내용을 자유롭게 입력해 주세요. 담당 AI가 도와드리겠습니다 😊\n상담원 연결이 필요하시면 아래 버튼을 눌러주세요.', [{ title: '💬 상담원 연결', code: 'AGENT' }, { title: '🏠 처음으로', code: 'RESTART' }]);
    if (SUB[code]) return done(brand, user, '아래에서 선택하시거나 직접 입력해 주세요.', SUB[code]);
    if (code === 'FLOW_ORDER') return askStep(supabase, brand, user, 'ORDER_NO');
    if (code === 'FLOW_AS_LOOKUP') return askStep(supabase, brand, user, 'AS_INPUT');
    if (code === 'FLOW_AS_REGISTER' || code === 'CAT_SERVICE') return askStep(supabase, brand, user, 'REG_NAME');
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
      return done(brand, user, '불편을 드려 정말 죄송합니다 😔\n빠르게 도와드릴 수 있도록 아래 [A/S 접수]를 남겨주시면 담당자가 확인 후 신속히 처리해 드리겠습니다.', POST_MENU);
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
    if (brain.detectOrder(input)) return askStep(supabase, brand, user, 'ORDER_NO', {}, '주문 조회를 도와드리겠습니다 📦');
    if (brain.detectService(input)) return askStep(supabase, brand, user, 'AS_INPUT', {}, 'A/S 접수 현황을 확인해드리겠습니다 🔧');
    if (brain.detectDealer(input)) {
      if (brand === 'nb' || brand === 'nb2') {
        const chips = brain.dealerRegions().map((r) => ({ title: `🗺️ ${r}`, code: `REGION::${r}` }));
        return done(brand, user, '가까운 대리점을 찾아드릴게요 🗺️\n지역을 선택해 주세요.', chips.slice(0, 13));
      }
      const d = brain.DEALER_INFO[brand];
      return done(brand, user, `가까운 판매점 안내 🗺️\n• ${d.linkLabel}\n${d.link}\n(${d.regions})`, [{ title: '🏠 처음으로', code: 'RESTART' }]);
    }
    if (brain.detectTire(input)) return askStep(supabase, brand, user, 'TIRE_MODEL');

    // ── 5) 인사 ──
    if (brain.isGreeting(input)) return done(brand, user, welcomeText(brand), CATEGORIES);

    // ── 5-1) 상담원 연결 요청 → 핸드오버 ──
    if (wantsAgent(input)) return goAgent(supabase, brand, user);

    // ── 6) RAG 자연어 답변 (FAQ 지식 기반 + 대화 맥락 유지) ──
    const { allowed, limit } = await checkRateLimit(supabase, `naver:${user}`, 'chat');
    if (!allowed) return done(brand, user, `오늘 AI 응답 한도(${limit}회)를 초과했어요. 아래 [A/S 접수]를 남겨주시면 담당자가 확인 후 안내해 드릴게요.`, POST_MENU);
    const faqs = await loadFaqs(supabase, brand);
    const history = await getHistory(supabase, user);
    const answer = await ragLlm(brand, input, faqs, user, history);
    await appendHistory(supabase, user, [{ role: 'user', content: input }, { role: 'assistant', content: answer }]);
    await logRequest(supabase, `naver:${user}`, brand, 'chat');
    return done(brand, user, answer, POST_MENU);
  } catch (e) {
    console.error('[naver-worker] 예외:', e.message);
    return done(brand, user, '죄송합니다, 잠시 후 다시 시도해 주세요.\n계속 문제가 있으면 [A/S 접수]를 남겨주시면 담당자가 확인해 드립니다.', POST_MENU);
  }
};

// 다단계 대화 처리
async function handleFlow(supabase, brand, user, input, state) {
  const d = state.data || {};
  const mallId = (brain.BRAND_META[brand] || {}).mallId;

  switch (state.step) {
    // 주문 조회
    case 'ORDER_NO':
      d.order_id = input;
      return askStep(supabase, brand, user, 'ORDER_NAME', d);
    case 'ORDER_NAME':
      d.buyer_name = input;
      return askStep(supabase, brand, user, 'ORDER_PHONE', d);
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
      d.name = input;
      return askStep(supabase, brand, user, 'REG_PHONE', d);
    case 'REG_PHONE':
      d.phone = input;
      return askStep(supabase, brand, user, 'REG_PRODUCT', d);
    case 'REG_PRODUCT':
      d.product_name = input;
      return askStep(supabase, brand, user, 'REG_SYMPTOM', d);
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
