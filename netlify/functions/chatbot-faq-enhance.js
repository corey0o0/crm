'use strict';
const { getSupabase, ok, err, preflight } = require('./_chatbot_utils');
const { getSettings } = require('./_chatbot_settings');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'POST only');

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err(400, '잘못된 요청'); }

  const { brand = 'nb', limit = 80 } = body;
  const brandUpper = brand.toUpperCase();
  const supabase = getSupabase();

  // 최근 미매칭(LLM 처리) 채팅 로그 수집
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: logs, error: logsError } = await supabase
    .from('chat_logs')
    .select('user_message, reply_type, created_at')
    .eq('brand', brand)
    .eq('reply_type', 'llm')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (logsError) return err(500, 'DB error');
  if (!logs || logs.length === 0) return ok({ suggestions: [], message: '분석할 데이터가 없습니다.' });

  // 현재 FAQ 레이블 목록
  // Anthropic API 키: DB(NB) 우선, env fallback
  const nbSettings = await getSettings(supabase, 'nb').catch(() => ({}));
  const anthropicKey = nbSettings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;

  const { data: existingFaqs } = await supabase
    .from('faq_items')
    .select('label')
    .in('brand', ['SHARED', brandUpper])
    .eq('is_active', true);

  const existingLabels = (existingFaqs || []).map(f => f.label).join(', ');
  const messages = logs.map(l => l.user_message).join('\n');
  const brandName = brand === 'xrb' ? 'X-RIDER(전동킥보드)' : '니어바이크(전기자전거)';

  const prompt =
    `당신은 ${brandName} 쇼핑몰 고객센터 FAQ 관리자입니다.\n\n` +
    `아래는 최근 챗봇이 FAQ로 답변하지 못하고 LLM으로 처리한 고객 질문들입니다.\n` +
    `기존 FAQ 카테고리: ${existingLabels || '없음'}\n\n` +
    `고객 질문 목록:\n${messages}\n\n` +
    `위 질문들을 분석하여 새로 추가하면 좋을 FAQ를 JSON 배열로 제안해주세요.\n` +
    `반드시 아래 형식만 반환하세요 (다른 텍스트 금지):\n` +
    `[{"label":"카테고리명","keywords":["키워드1","키워드2"],"answer":"답변내용","reason":"추가 이유"}]\n` +
    `최대 5개, 기존 카테고리와 겹치지 않는 것만 제안하세요. 데이터가 부족하면 빈 배열 [] 반환.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return err(502, 'AI 오류');

  const data = await res.json();
  const rawText = data.content?.[0]?.text || '[]';

  let suggestions = [];
  try {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) suggestions = JSON.parse(match[0]);
  } catch {
    suggestions = [];
  }

  return ok({ suggestions, analyzed: logs.length });
};
