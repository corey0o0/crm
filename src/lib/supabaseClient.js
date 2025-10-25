import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Anon Key가 설정되지 않았습니다.')
}

console.log('[Supabase Client] Using URL:', supabaseUrl);
console.log('[Supabase Client] Environment:', process.env.NODE_ENV);

// 매번 새로운 클라이언트 인스턴스 생성
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: (url, options = {}) => {
        // 모든 요청에 10초 타임아웃 적용
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        return fetch(url, {
          ...options,
          signal: controller.signal
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      }
    }
  });
};

// 기본 클라이언트 (하위 호환성)
export const supabase = createSupabaseClient();

/**
 * Supabase 쿼리를 타임아웃과 함께 실행하는 래퍼 함수
 * @param {Promise} queryPromise - Supabase 쿼리 프로미스
 * @param {number} timeout - 타임아웃 시간 (ms), 기본 10초
 * @returns {Promise} 쿼리 결과 또는 타임아웃 에러
 */
export const queryWithTimeout = async (queryPromise, timeout = 10000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('쿼리 시간 초과')), timeout);
  });
  
  try {
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error) {
    if (error.message.includes('쿼리 시간 초과') || error.name === 'AbortError') {
      console.error('[Supabase] 쿼리 타임아웃:', error);
      throw new Error('데이터 로딩 시간이 초과되었습니다. 다시 시도해주세요.');
    }
    throw error;
  }
}; 