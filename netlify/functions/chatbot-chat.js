'use strict';
const { getSupabase, getIp, checkRateLimit, logRequest, ok, err, preflight } = require('./_chatbot_utils');

const SYSTEM_PROMPTS = {
  nb: `[역할] 니어바이크(www.nearbike.co.kr) 자전거 전문 쇼핑몰 AI 고객센터입니다.
[정보] 취급: 자전거·부품·용품·의류 / 배송: 평균 2~3 영업일 / 반품: 수령 후 7일 이내 / 고객센터: 평일 09:00~18:00
[규칙] 위 정보에 없는 내용은 추측하지 말고 고객센터 이관을 안내하세요. 개인정보를 수집하지 마세요.
[형식] 한국어, 친절하고 간결하게, 3문장 이내`,

  xrb: `[역할] X-RIDER(slimpack.co.kr) 전동킥보드·전동자전거 전문 쇼핑몰 AI 고객센터입니다.
[정보] 배송: 평균 2~3 영업일 / 반품: 수령 후 7일 이내 / 면허: 원동기면허 이상 필수 / 헬멧: 착용 의무 / 고객센터: 평일 09:00~18:00
[규칙] 위 정보에 없는 내용은 추측하지 말고 고객센터 이관을 안내하세요. 개인정보를 수집하지 마세요.
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

  const { message, history = [], brand = 'nb' } = body;
  if (!message) return err(400, 'message 필수');

  const systemPrompt = SYSTEM_PROMPTS[brand] || SYSTEM_PROMPTS.nb;
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
      max_tokens: 300,
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
  const reply = data.content?.[0]?.text || '잠시 후 다시 시도해주세요.';

  await logRequest(supabase, ip, brand, 'chat');

  return ok({ reply, usage: { today: count + 1, limit } });
};
