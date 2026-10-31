'use strict';
const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}
function err(statusCode, message) {
  return { statusCode, headers: CORS, body: JSON.stringify({ error: message }) };
}
function preflight() {
  return { statusCode: 200, headers: CORS, body: '' };
}

// 로그인한 CRM 사용자만 통과시킨다 — r2-upload.js와 동일 패턴.
async function requireUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

const ALLOWED_FIELDS = ['business_number', 'name', 'ceo_name', 'address', 'business_type', 'business_category'];

const PROMPT = `이 이미지는 한국 사업자등록증입니다. 아래 항목을 읽어서 JSON 객체 하나만 반환하세요. 설명이나 다른 텍스트는 절대 포함하지 마세요.
{"business_number":"등록번호(000-00-00000 형식)","name":"상호(법인명)","ceo_name":"대표자 성명","address":"사업장 소재지 전체 주소","business_type":"업태(여러 개면 쉼표로 구분)","business_category":"종목(여러 개면 쉼표로 구분)"}
읽을 수 없는 항목은 빈 문자열("")로 두세요.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return err(405, 'POST only');

  const user = await requireUser(event);
  if (!user) return err(401, '로그인이 필요합니다.');

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return err(400, 'invalid json');
  }

  const { image, mediaType } = body;
  if (!image) return err(400, 'image 필수');

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return err(500, 'AI 설정 오류');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[agency-ocr] Anthropic error:', text);
      return err(502, 'AI 인식 실패');
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text || '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

    // 모델이 엉뚱한 키를 섞어 보내도 agencies 테이블에 쓰일 필드만 통과시킨다.
    const fields = {};
    for (const key of ALLOWED_FIELDS) {
      if (typeof parsed[key] === 'string') fields[key] = parsed[key];
    }
    return ok(fields);
  } catch (e) {
    console.error('[agency-ocr] 처리 실패:', e.message);
    return err(500, '인식 처리 중 오류가 발생했습니다.');
  }
};
