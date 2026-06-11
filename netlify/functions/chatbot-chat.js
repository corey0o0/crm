'use strict';
const { getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight } = require('./_chatbot_utils');

const SYSTEM_PROMPTS = {
  nb: `[역할] 니어바이크(www.nearbike.co.kr) 전기자전거(e-bike) 전문 쇼핑몰 AI 고객센터입니다.
[정보] 취급: 전기자전거(PAS 전동)·부품·용품·의류 / 배송: 평균 2~3 영업일 / 반품: 수령 후 7일 이내
[규칙] 제품은 전기자전거이므로 "켜짐/전원/시동/배터리" 문의는 전동 제품 기준으로 답하세요. 위 정보에 없는 내용은 추측하지 마세요. 개인정보를 수집하지 마세요.
[금지] 답변 끝에 "평일 09:00~18:00 고객센터로 연락" 같은 영업시간·연락 안내 문구를 습관적으로 붙이지 마세요. 사용자가 직접 물어볼 때만 안내하세요.
[형식] 한국어, 친절하고 간결하게, 3문장 이내`,

  xrb: `[역할] X-RIDER(slimpack.co.kr) 전동킥보드·전동자전거 전문 쇼핑몰 AI 고객센터입니다.
[정보] 배송: 평균 2~3 영업일 / 반품: 수령 후 7일 이내 / 면허: 원동기면허 이상 필수 / 헬멧: 착용 의무
[규칙] 위 정보에 없는 내용은 추측하지 마세요. 개인정보를 수집하지 마세요.
[금지] 답변 끝에 "평일 09:00~18:00 고객센터로 연락" 같은 영업시간·연락 안내 문구를 습관적으로 붙이지 마세요. 사용자가 직접 물어볼 때만 안내하세요.
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
      reply: `죄송합니다. 오늘 AI 응답 한도(${limit}회)를 초과했습니다.\n자세한 문의는 고객센터(평일 09:00~18:00)로 연락해 주세요.`,
      limited: true,
    });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err(400, '잘못된 요청'); }

  const { message, history = [], brand = 'nb', mode = 'chat', labels = [], session_id, matched_label } = body;

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
      `답변에 "평일 09:00~18:00 고객센터로 연락" 같은 영업시간·연락 안내 문구를 붙이지 마세요.\n` +
      `반드시 JSON만 반환하고 다른 텍스트는 절대 포함하지 마세요.\n\n` +
      `FAQ 카테고리: ${labelList}`;
    maxTokens = 350;
  } else {
    systemPrompt = SYSTEM_PROMPTS[brand] || SYSTEM_PROMPTS.nb;
    maxTokens = 300;
  }

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
      model: 'claude-haiku-4-5-20251001',
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
    const replyType = mode === 'smart' ? 'faq_llm' : 'llm';
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
