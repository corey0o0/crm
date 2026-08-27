'use strict';
//
// 네이버 톡톡 백그라운드 워커 (*-background.js → Netlify 비동기, 최대 15분)
// 위젯(public/chatbot.js) processInput() 흐름을 그대로 미러링 + send API로 push.
// 비즈니스 로직(주문/AS/등록)은 기존 함수 내부 HTTP 재사용, 대화 두뇌는 _chatbot_brain.
//
const { getSupabase, checkRateLimit, logRequest } = require('./_chatbot_utils');
const { textMessage, imageMessage, naverSend, typing, getState, setState, clearState, getHistory, appendHistory, clearHistory, passThread, takeThread, setHandover, isHandover, touchSession, markOffNotice, getOffNoticeAt } = require('./_naver_utils');
const { getSettings, isWithinHours, offhoursText } = require('./_chatbot_settings');
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

// 접수 직후 사진이 오면 "방금 그 접수 건"으로 안내해 주는 유효 시간
const LAST_SERVICE_TTL_MS = 30 * 60 * 1000;

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
  REG_PHOTO:   () => '증상이 보이는 사진이 있다면 보내주세요 📷\n없으면 [건너뛰기]를 눌러주세요.',
  TIRE_MODEL:  (brand) => `타이어(튜브) 교체를 도와드릴게요 🔧\n사용 중인 모델명을 알려주세요.\n${brand === 'xrb' ? '(예: X200 MAX SL / X50 FS)' : '(예: 블레이드FS / 카고)'}`,
};

// ── 접수 단계별 입력 검증 ──
// 안내를 못 보고 대화를 이어가면 답이 한 칸씩 밀려 들어간다.
// (실제 사고: 성함에 잡담, 연락처에 "넵", 제품명에 전화번호가 저장됨)
// 형식이 명백히 안 맞으면 같은 단계에 머물며 다시 묻는다.
const digitsOf = (s) => String(s || '').replace(/\D/g, '');
const looksLikePhone = (s) => {
  const n = digitsOf(s).length;
  return n >= 9 && n <= 11;
};

const STEP_VALIDATE = {
  REG_NAME: (v) => {
    const t = String(v).trim();
    if (looksLikePhone(t)) return '연락처 말고 성함을 입력해 주세요. (예: 홍길동)';
    if (t.length < 2 || t.length > 20) return '성함을 2~20자로 입력해 주세요. (예: 홍길동)';
    // 문장부호·자음만 쓴 표현이 들어가면 이름이 아니라 대화로 본다
    if (/[?!.,~]|[ㄱ-ㅎㅏ-ㅣ]/.test(t)) return '성함만 입력해 주세요. (예: 홍길동)';
    if ((t.match(/\s/g) || []).length > 1) return '성함만 입력해 주세요. (예: 홍길동)';
    return null;
  },
  REG_PHONE: (v) => (looksLikePhone(v) ? null : '연락처를 숫자로 입력해 주세요. (예: 010-1234-5678)'),
  REG_PRODUCT: (v) => {
    const t = String(v).trim();
    if (looksLikePhone(t)) return '제품명(모델명)을 입력해 주세요. (예: 블레이드FS / 카고)';
    if (t.length < 2 || t.length > 60) return '제품명(모델명)을 입력해 주세요. (예: 블레이드FS / 카고)';
    return null;
  },
  REG_SYMPTOM: (v) => (String(v).trim().length >= 2 ? null : '증상을 조금 더 자세히 입력해 주세요.'),
};

// 몇 번 어긋나면 혼자 붙잡고 있지 말고 상담원 연결을 안내한다
const STEP_RETRY_LIMIT = 3;

// 뒤로가기 시 되돌아갈 이전 단계 (입력했던 값은 유지)
const PREV_STEP = {
  ORDER_NAME:  'ORDER_NO',
  ORDER_PHONE: 'ORDER_NAME',
  REG_PHONE:   'REG_NAME',
  REG_PRODUCT: 'REG_PHONE',
  REG_SYMPTOM: 'REG_PRODUCT',
  REG_PHOTO:   'REG_SYMPTOM',
};

const SKIP_PHOTO = new Set(['건너뛰기', '없음', '없어요', 'skip', 'SKIP_PHOTO']);

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

// FAQ 버튼으로 답한 건을 chat_logs 에 남긴다. 실패해도 대화는 계속되어야 하므로 삼킨다.
async function logFaqUse(supabase, brand, user, label, answer) {
  try {
    const { error } = await supabase.from('chat_logs').insert({
      session_id: `naver:${user}`,
      brand,
      user_message: `[FAQ 선택] ${label}`,
      bot_reply: String(answer || '').slice(0, 1000),
      matched_faq_label: label,
      reply_type: 'faq',
    });
    if (error) console.error('[faq-log] 실패:', JSON.stringify(error));
  } catch (e) {
    console.error('[faq-log] 예외:', e.message);
  }
}

async function loadFaqs(supabase, brand) {
  const today = new Date().toISOString().slice(0, 10);
  const query = (cols) => supabase.from('faq_items')
    .select(cols)
    .in('brand', ['SHARED', (brain.BRAND_META[brand] || {}).dbBrand || 'NB'])
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    // id 까지 정렬해 순서를 고정한다 — 지식 문자열이 매번 같아야 프롬프트 캐시가 적중한다
    .order('is_announcement', { ascending: false })
    .order('id', { ascending: true });

  const { data, error } = await query('label, keywords, answer, is_announcement, images');
  if (!error) return data || [];

  // images 는 migrations/005 로 추가되는 컬럼이다. 마이그레이션 전에 이 코드가 먼저 배포되면
  // 컬럼이 없어 조회 전체가 실패하고, 그러면 챗봇이 FAQ 지식을 통째로 잃는다.
  // 첨부 이미지 없이라도 답변은 나가야 하므로 컬럼 없이 한 번 더 조회한다.
  console.error('[faq] images 컬럼 조회 실패 — 컬럼 없이 재시도:', error.message);
  const { data: fallback } = await query('label, keywords, answer, is_announcement');
  return fallback || [];
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

// 운영시간 외 안내를 답변 뒤에 덧붙인다.
// 입장 인사(open)에서는 신규·오랜만 방문에만 붙이므로, 자주 오는 고객은 그 안내를
// 볼 일이 없다. 그래서 실제로 문의를 보냈을 때 한 번 알려준다.
// 매 답변마다 붙으면 지저분하므로 마지막 발송 후 OFF_NOTICE_TTL_MS 안에는 생략한다.
const OFF_NOTICE_TTL_MS = 12 * 60 * 60 * 1000; // 12시간 — 같은 밤에 여러 번 물어도 한 번만
async function withOffhoursNotice(supabase, brand, user, text) {
  try {
    const settings = await getSettings(supabase, brand);
    if (isWithinHours(settings)) return text;
    const last = await getOffNoticeAt(supabase, user);
    if (last && Date.now() - last < OFF_NOTICE_TTL_MS) return text;
    await markOffNotice(supabase, user);
    return `${text}\n\n${offhoursText(settings)}`;
  } catch (e) {
    // 안내를 못 붙여도 답변 자체는 나가야 한다
    console.error('[offhours] 안내 덧붙이기 실패:', e.message);
    return text;
  }
}

const send = (brand, user, text, quick) => naverSend(brand, textMessage(user, text, quick));

// ── FAQ 첨부 이미지 ──
// 고객이 직접 눈으로 확인해야 하는 안내(커넥터 위치, 설치 방법 등)에만 채워 쓴다.
// 톡톡은 이미지 1장이 말풍선 1개라 답변당 최대 3장까지만 보낸다.
const FAQ_IMAGE_MAX = 3;
// AI 답변에 이미지를 붙일지 정하는 기준.
// 실제 고객 문장은 "전원이 안들어와요"처럼 키워드가 하나만 걸리는 경우가 많아
// 2점을 요구하면 정작 사진이 필요한 질문에 안 붙는다. 그렇다고 1점을 무조건 허용하면
// 애매하게 걸친 FAQ의 사진이 나갈 수 있어, 2점 이상이거나 2위보다 확실히 앞설 때만 붙인다.
const FAQ_IMAGE_MIN_SCORE = 2;

// 첨부 이미지를 붙여도 될 만큼 이 FAQ가 질문에 확실히 맞는가
function pickImageFaq(faqs, msg) {
  const scored = brain.matchFaqsScored(faqs, msg, 1, 2);
  const top = scored[0];
  if (!top) return null;
  const clear = top.score >= FAQ_IMAGE_MIN_SCORE || !scored[1] || top.score > scored[1].score;
  return clear ? top : null;
}

const faqImages = (faq) =>
  (Array.isArray(faq && faq.images) ? faq.images : [])
    .map((s) => String(s || '').trim())
    .filter((s) => /^https:\/\//.test(s))
    .slice(0, FAQ_IMAGE_MAX);

// 텍스트를 보낸 뒤 이미지를 이어서 보낸다. 이미지 전송이 실패해도 답변은 이미 나간 상태.
async function sendImages(brand, user, images) {
  for (const url of images) {
    const r = await naverSend(brand, imageMessage(user, url));
    if (!r.ok) console.error('[faq-image] 전송 실패:', url, r.error || '');
  }
}

async function done(brand, user, text, quick, images) {
  await naverSend(brand, typing(user, false));
  await send(brand, user, text, quick);
  if (images && images.length) await sendImages(brand, user, images);
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
  // 운영시간 외에 "잠시만 기다려 주세요"라고만 하면 곧 답이 올 것처럼 읽히므로 문구를 나눈다
  const settings = await getSettings(supabase, brand).catch(() => ({}));
  const wait = isWithinHours(settings)
    ? '접수된 순서대로 순차적으로 처리하고 있어요.\n잠시만 기다려 주시면 담당자가 확인 후 답변드리겠습니다 🙏'
    : '지금은 상담 운영시간이 아니라 바로 확인이 어려워요.\n남겨주신 내용은 다음 영업일에 순서대로 확인 후 답변드리겠습니다 🙏';
  await send(brand, user, `상담원에게 연결해 드릴게요 🙂\n${wait}\n\n※ 연결 중에는 챗봇이 응답하지 않습니다. 궁금하신 내용을 미리 남겨두시면 함께 확인해 드릴게요.`);
  await setHandover(supabase, user, true);
  await naverSend(brand, passThread(user, 1));
  return { statusCode: 200, body: '' };
}

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 200, body: '' }; }
  const { brand = 'nb', user, text = '', hasImage = false, imageUrl = '' } = body;
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

  // 사진 수신 — A/S 접수 중 사진 첨부 단계(REG_PHOTO)에서 온 사진은 handleFlow가 처리하므로 여기서 가로채지 않는다.
  // 그 외 시점의 사진은 봇이 맥락 없이 볼 수 없으므로 추측 답변 대신 A/S 접수로 유도.
  // 단, 방금 접수를 막 완료한 직후라면 "또 접수하라"는 안내는 앞뒤가 안 맞으므로
  // 그 접수번호를 언급해 준다.
  const preState = await getState(supabase, user);
  if (hasImage && preState.step !== 'REG_PHOTO') {
    const st = preState;
    const ls = st.lastService;
    if (ls && ls.id && Date.now() - (ls.at || 0) < LAST_SERVICE_TTL_MS) {
      return done(brand, user, `사진 잘 받았습니다 📷\n방금 접수하신 A/S #${ls.id} 건과 함께 담당자가 확인해 드릴게요.`, POST_MENU);
    }
    return done(brand, user, '사진 잘 받았습니다 📷\n사진만으로는 정확한 진단이 어려워, 아래 [A/S 접수]를 남겨주시면 담당자가 사진과 함께 확인해 정확히 안내해 드릴게요.', POST_MENU);
  }

  // 레거시/혼선 코드 정규화 (옛 환영메뉴 코드 호환: CAT_AS/CAT_FAQ/CAT_AGENT)
  if (code === 'CAT_AS') code = 'CAT_SERVICE';
  else if (code === 'CAT_AGENT') code = 'AGENT';
  else if (code === 'CAT_FAQ') code = 'CAT_OTHER';

  // 빠른응답 코드가 control이면 그대로, 아니면 사용자 텍스트로 취급
  const input = (code && !isControl(code)) ? code : String(text || '').trim();
  const state = preState;

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
      if (hit) {
        // 어떤 FAQ 가 실제로 쓰였는지 남긴다 (관리자 화면 사용 횟수 집계용)
        await logFaqUse(supabase, brand, user, label, hit.answer);
        return done(brand, user, hit.answer, POST_MENU, faqImages(hit));
      }
    }

    // REG_PHOTO 단계에서 사진만(텍스트 없이) 온 경우는 input이 비어도 handleFlow로 보내야 한다
    if (!input && !(hasImage && state.step === 'REG_PHOTO')) return done(brand, user, welcomeText(brand), CATEGORIES);

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
      const r = await handleFlow(supabase, brand, user, input, state, hasImage, imageUrl);
      if (r) return r;
    }

    // ── 4) 인텐트 감지 (자유 입력 → 플로우 진입) ──
    if (brain.detectOrder(input)) return askStep(supabase, brand, user, 'ORDER_NO', {}, '주문 조회를 도와드리겠습니다 📦');
    if (brain.detectService(input)) return askStep(supabase, brand, user, 'AS_INPUT', {}, 'A/S 접수 현황을 확인해드리겠습니다 🔧');
    if (brain.detectDealer(input)) {
      if (brand === 'nb' || brand === 'nb2') {
        // "동탄에 대리점 있나요?" 처럼 지명을 함께 말하면 지역 선택을 건너뛰고 바로 안내
        const byPlace = brain.buildNearbyDealerAnswer(input);
        if (byPlace) return done(brand, user, byPlace, POST_MENU);
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
    if (!allowed) return done(brand, user, `24시간 이내 AI 응답 한도(${limit}회)를 초과했어요. 아래 [A/S 접수]를 남겨주시면 담당자가 확인 후 안내해 드릴게요.`, POST_MENU);
    const faqs = await loadFaqs(supabase, brand);
    const history = await getHistory(supabase, user);
    const answer = await ragLlm(brand, input, faqs, user, history);
    await appendHistory(supabase, user, [{ role: 'user', content: input }, { role: 'assistant', content: answer }]);
    await logRequest(supabase, `naver:${user}`, brand, 'chat');
    // 고객이 직접 확인해야 하는 안내는 사진이 있어야 이해되므로, 질문과 충분히 맞는
    // FAQ에 첨부 이미지가 있으면 답변 뒤에 같이 보낸다.
    // LLM 답변은 어느 FAQ를 썼는지 알려주지 않으므로 키워드 점수로 따로 판정한다.
    const top = pickImageFaq(faqs, input);
    const images = top ? faqImages(top.f) : [];
    if (images.length) console.log(`[faq-image] label=${top.f.label} score=${top.score} 장수=${images.length}`);
    // 대화 이력에는 안내 문구를 빼고 순수 답변만 남긴다(맥락 오염 방지)
    return done(brand, user, await withOffhoursNotice(supabase, brand, user, answer), POST_MENU, images);
  } catch (e) {
    console.error('[naver-worker] 예외:', e.message);
    return done(brand, user, '죄송합니다, 잠시 후 다시 시도해 주세요.\n계속 문제가 있으면 [A/S 접수]를 남겨주시면 담당자가 확인해 드립니다.', POST_MENU);
  }
};

// 다단계 대화 처리
async function handleFlow(supabase, brand, user, input, state, hasImage, imageUrl) {
  const d = state.data || {};
  const mallId = (brain.BRAND_META[brand] || {}).mallId;

  // 형식이 명백히 어긋나면 다음 단계로 넘기지 않고 같은 단계에서 다시 묻는다.
  // 이게 없으면 고객이 안내를 못 보고 대화를 이어갈 때 값이 한 칸씩 밀려 저장된다.
  const problem = STEP_VALIDATE[state.step] && STEP_VALIDATE[state.step](input);
  if (problem) {
    d._tries = (d._tries || 0) + 1;
    await setState(supabase, user, { step: state.step, data: d });
    if (d._tries >= STEP_RETRY_LIMIT) {
      return done(brand, user, `${problem}\n\n입력이 어려우시면 아래 [상담원 연결]을 눌러주세요.`,
        [{ title: '💬 상담원 연결', code: 'AGENT' }, ...NAV]);
    }
    return done(brand, user, problem, NAV);
  }
  delete d._tries; // 통과했으면 재시도 카운터는 접수 내용에 남기지 않는다

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
      d.symptom = input;
      await setState(supabase, user, { step: 'REG_PHOTO', data: d });
      return done(brand, user, STEP_PROMPT.REG_PHOTO(brand), [{ title: '건너뛰기', code: 'SKIP_PHOTO' }, ...NAV]);
    }
    case 'REG_PHOTO': {
      if (hasImage && imageUrl) d.photo_url = imageUrl;
      else if (!SKIP_PHOTO.has(input.trim())) {
        // 사진도, 건너뛰기도 아닌 다른 입력 — 다시 안내
        return done(brand, user, STEP_PROMPT.REG_PHOTO(brand), [{ title: '건너뛰기', code: 'SKIP_PHOTO' }, ...NAV]);
      }
      await clearState(supabase, user);
      const res = await callFn('chatbot-register-service', { method: 'POST', user, body: { name: d.name, phone: d.phone, product_name: d.product_name, symptom: d.symptom, photo_url: d.photo_url, brand } });
      if (!res.success) return done(brand, user, `접수 중 오류가 발생했습니다: ${res.error || '잠시 후 다시 시도'}`, POST_MENU);
      await setState(supabase, user, { step: 'IDLE', data: {}, lastService: { id: res.service_id, at: Date.now() } });
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
