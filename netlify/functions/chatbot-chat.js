'use strict';
const { getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight } = require('./_chatbot_utils');
const { getSettings } = require('./_chatbot_settings');

// 모드별 모델 — 자연스러운 대화(rag/chat)는 Sonnet, 분류(smart)는 빠른 Haiku
const MODEL_BY_MODE = {
  smart: 'claude-haiku-4-5-20251001',
  rag: 'claude-sonnet-4-6',
  chat: 'claude-sonnet-4-6',
};

const SYSTEM_PROMPTS = {
  nb: `[역할] 니어바이크(www.nearbike.co.kr) 전기자전거(e-bike) 전문 쇼핑몰 AI 고객센터입니다.
[정보] 취급: 전기자전거(PAS 전동)·부품·용품·의류 / 배송: 평균 2~3 영업일 / 반품: 수령 후 7일 이내
[규칙] 제품은 전기자전거이므로 "켜짐/전원/시동/배터리" 문의는 전동 제품 기준으로 답하세요. 위 정보에 없는 내용은 추측하지 마세요. 개인정보를 수집하지 마세요.
[고객센터] 이 챗봇이 곧 고객센터입니다. 전화 상담은 운영하지 않습니다. 절대 전화번호·"전화로 연락"·"고객센터로 전화" 같은 통화 안내를 하지 마세요.
[해결불가] 챗봇으로 해결이 어렵거나 직접 처리·점검이 필요한 경우 전화가 아니라 "A/S 접수"를 남기도록 안내하세요. (담당자가 접수 확인 후 처리)
[형식] 한국어, 친절하고 간결하게, 3문장 이내`,

  xrb: `[역할] X-RIDER(slimpack.co.kr) 전동킥보드·전동자전거 전문 쇼핑몰 AI 고객센터입니다.
[정보] 배송: 평균 2~3 영업일 / 반품: 수령 후 7일 이내 / 면허: 원동기면허 이상 필수 / 헬멧: 착용 의무
[규칙] 위 정보에 없는 내용은 추측하지 마세요. 개인정보를 수집하지 마세요.
[고객센터] 이 챗봇이 곧 고객센터입니다. 전화 상담은 운영하지 않습니다. 절대 전화번호·"전화로 연락"·"고객센터로 전화" 같은 통화 안내를 하지 마세요.
[해결불가] 챗봇으로 해결이 어렵거나 직접 처리·점검이 필요한 경우 전화가 아니라 "A/S 접수"를 남기도록 안내하세요. (담당자가 접수 확인 후 처리)
[형식] 한국어, 친절하고 간결하게, 3문장 이내`,
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'POST only');

  const supabase = getSupabase();
  const ip = getIp(event);

  const { allowed, count, limit } = await checkRateLimit(supabase, ip, 'chat');
  if (!allowed) {
    return ok({
      reply: `죄송합니다. 오늘 AI 응답 한도(${limit}회)를 초과했습니다.\n자세한 문의는 [A/S 접수]를 남겨주시면 담당자가 확인 후 안내해 드립니다.`,
      limited: true,
    });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err(400, '잘못된 요청'); }

  const { message, history = [], brand = 'nb', mode = 'chat', labels = [], knowledge = '', session_id, matched_label } = body;

  if (mode === 'log') {
    if (message) {
      try {
        await supabase.from('chat_logs').insert({
          session_id: session_id || null,
          brand,
          user_message: message,
          bot_reply: null,
          matched_faq_label: matched_label || null,
          reply_type: 'faq',
        });
      } catch {}
    }
    return ok({ ok: true });
  }

  if (!message) return err(400, 'message 필수');

  let systemPrompt, maxTokens;

  if (mode === 'smart' && labels.length > 0) {
    const brandName = brand === 'xrb' ? 'X-RIDER' : '니어바이크';
    const labelList = labels.join(' / ');
    systemPrompt =
      `당신은 ${brandName} 고객센터 AI입니다.\n` +
      `아래 FAQ 카테고리 중 고객 질문이 해당하는 것이 있으면 반드시 JSON {"type":"faq","label":"카테고리명"} 만 반환하세요.\n` +
      `해당 카테고리가 없을 때만 3문장 이내 한국어로 답변 후 {"type":"reply","reply":"답변내용"} 을 반환하세요.\n` +
      `${brandName === '니어바이크' ? '제품은 전기자전거이므로 "켜짐/전원/시동" 문의는 전동 제품 기준으로 답하세요.\\n' : ''}` +
      `이 챗봇이 곧 고객센터이며 전화 상담은 없습니다. 전화번호·통화 안내는 절대 하지 말고, 해결이 어려우면 "A/S 접수"를 남기도록 안내하세요.\n` +
      `반드시 JSON만 반환하고 다른 텍스트는 절대 포함하지 마세요.\n\n` +
      `FAQ 카테고리: ${labelList}`;
    maxTokens = 350;
  } else if (mode === 'rag') {
    // RAG: FAQ 지식으로 근거를 잡되, 사람 상담원처럼 자연스럽게 재구성해 답변
    const brandName = brand === 'xrb' ? 'X-RIDER' : '니어바이크';
    const persona = brand === 'xrb' ? '엑스라이더 상담매니저' : '니어바이크 상담매니저';
    const ebikeNote = brand === 'xrb'
      ? '취급 제품은 전동킥보드·전동자전거입니다.'
      : '취급 제품은 전기자전거(PAS 전동)입니다. "켜짐/전원/시동/배터리" 문의는 전동 제품 기준으로 답하세요.';
    const know = String(knowledge || '').slice(0, 12000);
    systemPrompt =
      `당신은 ${brandName}의 친절한 ${persona}입니다. 게시판 안내문이 아니라, 사람처럼 1:1로 따뜻하게 상담하세요.\n` +
      `${ebikeNote}\n` +
      `[말투] 먼저 공감/맞장구를 한 뒤 핵심을 알려주세요. 2~4문장으로 짧고 자연스럽게. 매번 같은 문구를 반복하지 말고, 딱딱한 "~안내드립니다" 톤은 피하세요. 이모지는 메시지당 1개 이하.\n` +
      `[기종확인] 증상·소음·고장·수리·부품·제원처럼 모델에 따라 답이 달라지는 문의는, 고객이 어떤 모델(기종)인지 아직 말하지 않았다면 진단·해결을 시작하기 전에 먼저 "어떤 모델(기종)을 사용 중이신가요?"라고 자연스럽게 한 번 여쭤보고, 모델을 알게 되면 그 모델 기준으로 답하세요. (이전 대화에서 모델을 이미 말했다면 다시 묻지 말 것.) 단, 배송·반품·교환·결제·운영시간·주문조회처럼 모델과 무관한 문의는 굳이 묻지 마세요.\n` +
      `[근거] 아래 [자료]에 있는 내용만 사실 근거로 사용하세요. 자료에 없는 수치·규격·정책은 절대 지어내지 말고, 모르면 솔직히 모른다고 한 뒤 직접 확인이 필요하면 "A/S 접수"를 자연스럽게 권하세요.\n` +
      `[맥락] 이전 대화를 참고해 이어서 답하세요. 고객이 이미 말한 모델/내용을 다시 묻지 말고, 했던 안내를 반복하지 마세요.\n` +
      `[고객센터] 이 채팅이 곧 고객센터이며 전화 상담은 운영하지 않습니다. 전화번호·"전화로 연락"·"고객센터로 전화" 같은 통화 안내는 절대 하지 마세요. 개인정보는 수집하지 마세요.\n\n` +
      `[자료]\n${know || '(관련 자료 없음)'}`;
    maxTokens = 450;
  } else {
    systemPrompt = SYSTEM_PROMPTS[brand] || SYSTEM_PROMPTS.nb;
    maxTokens = 300;
  }

  // 관리자가 등록한 금지 표현 주입 (모든 모드 공통)
  try {
    const settings = await getSettings(supabase, brand);
    const forbidden = Array.isArray(settings.forbidden_phrases) ? settings.forbidden_phrases.filter(Boolean) : [];
    if (forbidden.length) {
      systemPrompt += `\n\n[절대 금지] 다음 표현·문구는 어떤 경우에도 답변에 포함하지 마세요(유사 표현도 금지): ${forbidden.map((s) => `"${s}"`).join(', ')}.`;
    }
  } catch {}

  const model = MODEL_BY_MODE[mode] || 'claude-haiku-4-5-20251001';
  const messages = [
    ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[chatbot-chat] Anthropic error:', text);
    return err(502, 'AI 응답 오류');
  }

  const data = await res.json();
  const rawText = data.content?.[0]?.text || '';

  await logRequest(supabase, ip, brand, 'chat');

  // 채팅 로그 저장 (비동기, 오류 무시)
  try {
    const replyType = mode === 'smart' ? 'faq_llm' : (mode === 'rag' ? 'rag' : 'llm');
    const jsonMatch = mode === 'smart' ? rawText.match(/\{[\s\S]*\}/) : null;
    const parsed = jsonMatch ? (() => { try { return JSON.parse(jsonMatch[0]); } catch { return null; } })() : null;
    const finalReplyType = (parsed?.type === 'faq') ? 'faq_llm' : replyType;
    const matchedLabel = parsed?.label || null;
    const botReply = parsed?.reply || (mode !== 'smart' ? rawText : null);
    await supabase.from('chat_logs').insert({
      session_id: session_id || null,
      brand,
      user_message: message,
      bot_reply: botReply?.slice(0, 1000) || null,
      matched_faq_label: matchedLabel,
      reply_type: finalReplyType,
    });
  } catch {}

  if (mode === 'smart') {
    // JSON 추출 (LLM이 마크다운 코드블록 등을 붙일 경우 대비)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return ok({ ...parsed, usage: { today: count + 1, limit } });
      } catch {}
    }
    // 파싱 실패 시 일반 답변으로 반환
    return ok({ type: 'reply', reply: rawText || '잠시 후 다시 시도해주세요.', usage: { today: count + 1, limit } });
  }

  return ok({ reply: rawText || '잠시 후 다시 시도해주세요.', usage: { today: count + 1, limit } });
};
