/**
 * 보안 강화된 API 유틸리티
 * 기존 restApiUtils.js의 보안 버전
 */

import { createSecureHeaders, safeLog, sanitizeUrl, maskApiKey } from './securityUtils';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL과 Anon Key가 설정되지 않았습니다.');
}

/**
 * 보안 강화된 REST API 호출 함수
 * @param {string} table - 테이블 이름
 * @param {Object} options - 쿼리 옵션
 * @returns {Promise<Array>} 조회 결과
 */
export const secureFetchFromSupabase = async (table, options = {}) => {
  const {
    select = '*',
    filter = '',
    order = '',
    limit = null,
    offset = 0,
    signal = null
  } = options;

  // URL 구성
  let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  
  if (filter) {
    url += `&${filter}`;
  }
  
  if (order) {
    url += `&order=${encodeURIComponent(order)}`;
  }
  
  if (limit) {
    url += `&limit=${limit}`;
  }
  if (offset && Number.isFinite(offset) && offset > 0) {
    url += `&offset=${offset}`;
  }

  // 안전한 로깅 (민감한 정보 마스킹)
  safeLog(`[Secure API] Fetching from ${table}`, {
    url: sanitizeUrl(url),
    apiKey: maskApiKey(supabaseKey)
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: createSecureHeaders(supabaseKey),
    signal
  });

  safeLog(`[Secure API] ${table} response status`, {
    status: response.status,
    statusText: response.statusText
  });

  if (!response.ok) {
    throw new Error(`REST API error for ${table}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  safeLog(`[Secure API] ${table} data received`, {
    itemCount: data?.length || 0
  });
  
  return data;
};

/**
 * 보안 강화된 카운트 조회 함수
 * @param {string} table - 테이블 이름
 * @param {string} filter - 필터 조건
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise<number>} 총 개수
 */
export const secureCountFromSupabase = async (table, filter = '', signal = null) => {
  let url = `${supabaseUrl}/rest/v1/${table}?select=count`;
  
  if (filter) {
    url += `&${filter}`;
  }

  safeLog(`[Secure API] Counting ${table}`, {
    url: sanitizeUrl(url),
    filter: filter ? '***' : 'none'
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: createSecureHeaders(supabaseKey, {
      'Prefer': 'count=exact'
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Count API error for ${table}: ${response.status} ${response.statusText}`);
  }

  const count = response.headers.get('content-range');
  const totalCount = count ? parseInt(count.split('/')[1]) : 0;
  
  safeLog(`[Secure API] ${table} count result`, {
    totalCount
  });
  
  return totalCount;
};

/**
 * 보안 강화된 POST 요청
 * @param {string} table - 테이블 이름
 * @param {Object} data - 전송할 데이터
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise<Object>} 응답 데이터
 */
export const securePostToSupabase = async (table, data, signal = null) => {
  const url = `${supabaseUrl}/rest/v1/${table}`;

  safeLog(`[Secure API] POST to ${table}`, {
    url: sanitizeUrl(url),
    dataKeys: Object.keys(data)
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: createSecureHeaders(supabaseKey, {
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(data),
    signal
  });

  if (!response.ok) {
    throw new Error(`POST API error for ${table}: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  safeLog(`[Secure API] POST ${table} success`, {
    resultCount: Array.isArray(result) ? result.length : 1
  });
  
  return result;
};

/**
 * 보안 강화된 PUT 요청
 * @param {string} table - 테이블 이름
 * @param {string} id - 업데이트할 레코드 ID
 * @param {Object} data - 업데이트할 데이터
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise<Object>} 응답 데이터
 */
export const securePutToSupabase = async (table, id, data, signal = null) => {
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}`;

  safeLog(`[Secure API] PUT to ${table}`, {
    url: sanitizeUrl(url),
    id: maskSensitiveData(id),
    dataKeys: Object.keys(data)
  });

  const response = await fetch(url, {
    method: 'PATCH',
    headers: createSecureHeaders(supabaseKey, {
      'Prefer': 'return=representation'
    }),
    body: JSON.stringify(data),
    signal
  });

  if (!response.ok) {
    throw new Error(`PUT API error for ${table}: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  safeLog(`[Secure API] PUT ${table} success`, {
    resultCount: Array.isArray(result) ? result.length : 1
  });
  
  return result;
};

/**
 * 보안 강화된 DELETE 요청
 * @param {string} table - 테이블 이름
 * @param {string} id - 삭제할 레코드 ID
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise<Object>} 응답 데이터
 */
export const secureDeleteFromSupabase = async (table, id, signal = null) => {
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${id}`;

  safeLog(`[Secure API] DELETE from ${table}`, {
    url: sanitizeUrl(url),
    id: maskSensitiveData(id)
  });

  const response = await fetch(url, {
    method: 'DELETE',
    headers: createSecureHeaders(supabaseKey, {
      'Prefer': 'return=representation'
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`DELETE API error for ${table}: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  safeLog(`[Secure API] DELETE ${table} success`, {
    resultCount: Array.isArray(result) ? result.length : 1
  });
  
  return result;
};
