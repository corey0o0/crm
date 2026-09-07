'use strict';
const { getSupabase, ok, err, preflight } = require('./_chatbot_utils');
const { getSettings, serviceBrandOf } = require('./_chatbot_settings');

// chat_logs.brand 에는 채널 코드(nb/nb2/xrb)가 그대로 들어간다.
// 니어바이크는 공식홈(nb2)과 스마트스토어(nb)가 같은 브랜드이므로 함께 분석한다.
const CHANNELS_OF = { nb: ['nb', 'nb2'], nb2: ['nb', 'nb2'], xrb: ['xrb'] };

// FAQ 로 직답하지 못해 LLM 이 답한 건들 = FAQ 보강 후보.
// 톡톡은 rag, 웹 위젯 일반 대화는 llm 으로 기록된다(faq/faq_llm 은 이미 FAQ 가 답한 것).
const UNANSWERED_TYPES = ['rag', 'llm'];
const MIN_QUESTION_LENGTH = 4;
const SYSTEM_PREFIXES = ['[FAQ 선택]', '[상담원 연결 요청]', '[상담원 응대]'];
const CONFIDENCES = new Set(['high', 'medium', 'low']);

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanAnswer(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildQuestionGroups(logs) {
  const map = new Map();
  for (const log of logs || []) {
    const text = cleanText(log.user_message);
    if (text.length < MIN_QUESTION_LENGTH) continue;
    if (SYSTEM_PREFIXES.some(prefix => text.startsWith(prefix))) continue;

    const found = map.get(text);
    if (found) found.count += 1;
    else map.set(text, { text, count: 1, samples: [text], order: map.size });
  }

  const groups = Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map(({ text, count, samples }, index) => ({ id: `G${index + 1}`, text, count, samples }));

  return {
    groups,
    summary: {
      analyzed: (logs || []).length,
      unique_questions: groups.length,
      total_question_count: groups.reduce((sum, g) => sum + g.count, 0),
    },
  };
}

function normalizeKeywords(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(list.map(cleanText).filter(Boolean))).slice(0, 8);
}

function normalizeSuggestions(rawSuggestions, existingFaqs = [], groups = []) {
  const existingLabels = new Set((existingFaqs || [])
    .map(faq => cleanText(faq.label).toLowerCase())
    .filter(Boolean));
  const groupById = new Map((groups || []).map(g => [g.id, g]));

  return (Array.isArray(rawSuggestions) ? rawSuggestions : [])
    .map(s => {
      const label = cleanText(s?.label);
      const answer = cleanAnswer(s?.answer);
      const groupIds = Array.from(new Set(Array.isArray(s?.groups) ? s.groups.map(cleanText).filter(Boolean) : []));
      const evidenceGroups = groupIds.map(id => groupById.get(id)).filter(Boolean);
      const evidenceCount = evidenceGroups.reduce((sum, g) => sum + (Number(g.count) || 0), 0);
      const questionCount = evidenceCount || Math.max(1, Math.round(Number(s?.question_count) || 0));
      const evidenceSamples = evidenceGroups.flatMap(g => Array.isArray(g.samples) ? g.samples : []);
      const aiSamples = Array.isArray(s?.sample_questions) ? s.sample_questions : [];
      const sampleQuestions = (evidenceSamples.length ? evidenceSamples : aiSamples)
        .map(cleanText)
        .filter(Boolean)
        .slice(0, 3);
      const estimated = evidenceCount || Math.round(Number(s?.estimated_saves) || 0);

      const normalized = {
        label,
        keywords: normalizeKeywords(s?.keywords),
        answer,
        reason: cleanText(s?.reason),
        question_count: questionCount,
        sample_questions: sampleQuestions,
        estimated_saves: estimated > 0 ? estimated : questionCount,
        confidence: CONFIDENCES.has(s?.confidence) ? s.confidence : 'medium',
      };
      if (groupIds.length) normalized.groups = groupIds;
      return normalized;
    })
    .filter(s => s.label && s.answer && !existingLabels.has(s.label.toLowerCase()))
    .slice(0, 5);
}

exports.buildQuestionGroups = buildQuestionGroups;
exports.normalizeSuggestions = normalizeSuggestions;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'POST only');

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err(400, '잘못된 요청'); }

  const { brand = 'nb', limit = 80 } = body;
  const channels = CHANNELS_OF[String(brand).toLowerCase()] || ['nb', 'nb2'];
  const dbBrand = serviceBrandOf(brand); // faq_items 는 NB/XRB 만 사용
  const supabase = getSupabase();

  // 최근 미매칭(LLM 처리) 채팅 로그 수집
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: logs, error: logsError } = await supabase
    .from('chat_logs')
    .select('user_message, reply_type, created_at')
    .in('brand', channels)
    .in('reply_type', UNANSWERED_TYPES)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (logsError) return err(500, 'DB error');
  if (!logs || logs.length === 0) return ok({ suggestions: [], message: '분석할 데이터가 없습니다.' });

  const { groups, summary } = buildQuestionGroups(logs);
  if (groups.length === 0) return ok({ suggestions: [], summary, message: 'FAQ 후보로 쓸 고객 질문이 없습니다.' });

  // 현재 FAQ 목록
  // Anthropic API 키: DB(NB) 우선, env fallback
  const nbSettings = await getSettings(supabase, 'nb').catch(() => ({}));
  const anthropicKey = nbSettings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;

  const { data: existingFaqs } = await supabase
    .from('faq_items')
    .select('label, keywords, answer')
    .in('brand', ['SHARED', dbBrand])
    .eq('is_active', true);

  const existingList = (existingFaqs || []).map(f => {
    const keywords = Array.isArray(f.keywords) ? f.keywords.join(', ') : '';
    return `- ${f.label}${keywords ? ` (${keywords})` : ''}`;
  }).join('\n');
  const messages = groups.map(g => `${g.id}. (${g.count}건) ${g.text}`).join('\n');
  const brandName = brand === 'xrb' ? 'X-RIDER(전동킥보드)' : '니어바이크(전기자전거)';

  const prompt =
    `당신은 ${brandName} 쇼핑몰 고객센터 FAQ 관리자입니다.\n\n` +
    `아래는 최근 30일 동안 FAQ로 답변하지 못하고 LLM/RAG로 처리한 고객 질문입니다. 괄호의 건수는 같은 질문 반복 횟수입니다.\n` +
    `기존 FAQ와 의미가 겹치는 제안은 만들지 마세요. 답변은 고객에게 바로 보여줄 수 있게 구체적으로 작성하세요.\n\n` +
    `기존 FAQ:\n${existingList || '없음'}\n\n` +
    `고객 질문 목록:\n${messages}\n\n` +
    `반드시 아래 JSON 배열 형식만 반환하세요 (다른 텍스트 금지):\n` +
    `[{
` +
    `  "label":"카테고리명",
` +
    `  "keywords":["키워드1","키워드2","키워드3"],
` +
    `  "answer":"답변내용",
` +
    `  "reason":"추가 이유",
` +
    `  "groups":["G1","G3"],
` +
    `  "question_count":2,
` +
    `  "sample_questions":["대표 질문1","대표 질문2"],
` +
    `  "estimated_saves":2,
` +
    `  "confidence":"high"
` +
    `}]\n` +
    `최대 5개. groups에는 근거가 된 고객 질문 ID만 넣으세요. keywords는 3~8개. confidence는 high/medium/low 중 하나. 데이터가 부족하면 빈 배열 [] 반환.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return err(502, 'AI 오류');

  const data = await res.json();
  const rawText = data.content?.[0]?.text || '[]';

  let parsed = [];
  try {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = [];
  }

  const suggestions = normalizeSuggestions(parsed, existingFaqs, groups);
  return ok({
    suggestions,
    analyzed: logs.length,
    summary: {
      ...summary,
      suggestions: suggestions.length,
      estimated_saves: suggestions.reduce((sum, s) => sum + (Number(s.estimated_saves) || 0), 0),
    },
  });
};
