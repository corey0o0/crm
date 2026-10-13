'use strict';
// ponytail: 브라우저가 r2.dev 를 직접 fetch 하면 CORS 헤더/엣지캐시 상태에 매번 걸림.
// 서버↔서버 요청엔 CORS 규칙이 안 걸리니, 여기서 대신 받아서 그대로 넘겨준다.
// (엑셀 다운로드 이미지 임베드용. 업로드 등 다른 경로는 안 건드림)

const ALLOWED_HOST = 'pub-27aaa3bc54074d938a076a095676c921.r2.dev';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=86400',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const target = event.queryStringParameters && event.queryStringParameters.url;
  if (!target) {
    return { statusCode: 400, headers: CORS, body: 'url 파라미터 필수' };
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return { statusCode: 400, headers: CORS, body: 'invalid url' };
  }
  if (parsed.host !== ALLOWED_HOST) {
    return { statusCode: 403, headers: CORS, body: '허용되지 않은 도메인' };
  }

  try {
    const res = await fetch(parsed.toString());
    if (!res.ok) {
      return { statusCode: res.status, headers: CORS, body: '원본 이미지 요청 실패' };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error('[r2-image-proxy] 실패:', e.message);
    return { statusCode: 502, headers: CORS, body: '이미지 프록시 실패' };
  }
};
