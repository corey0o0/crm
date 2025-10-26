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

// 유휴 상태 감지 및 재연결
let lastActivityTime = Date.now();
let idleCheckInterval = null;

// 활동 감지 이벤트
const resetIdleTimer = () => {
  lastActivityTime = Date.now();
};

// 유휴 감지 시작
const startIdleDetection = () => {
  if (idleCheckInterval) return;
  
  // 사용자 활동 감지
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    window.addEventListener(event, resetIdleTimer, { passive: true });
  });
  
  // 30초마다 유휴 시간 체크
  idleCheckInterval = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime;
    
    // 5분 이상 유휴 시 재연결 필요 플래그 설정
    if (idleTime > 5 * 60 * 1000) {
      console.log('[Supabase] 5분 이상 유휴 감지 - 다음 쿼리 시 재연결 필요');
      // window에 플래그 설정 (AuthContext에서 확인 가능)
      window._supabaseNeedsReconnect = true;
    }
  }, 30000);
};

// 페이지 로드 시 유휴 감지 시작
if (typeof window !== 'undefined') {
  startIdleDetection();
  
  // 포커스 복귀 시 즉시 재연결 필요 플래그 체크
  window.addEventListener('focus', () => {
    const idleTime = Date.now() - lastActivityTime;
    if (idleTime > 5 * 60 * 1000) {
      console.log('[Supabase] 포커스 복귀 + 장시간 유휴 - 재연결 필요');
      window._supabaseNeedsReconnect = true;
    }
  });
}

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

/**
 * 유휴 후 재연결이 필요한지 확인하고 세션 갱신
 * @returns {Promise<boolean>} 재연결 성공 여부
 */
export const ensureConnection = async () => {
  if (!window._supabaseNeedsReconnect) {
    return true; // 재연결 불필요
  }
  
  console.log('[Supabase] 재연결 시작...');
  
  try {
    // 세션 갱신
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('[Supabase] 재연결 실패:', error);
      return false;
    }
    
    console.log('[Supabase] 재연결 성공');
    window._supabaseNeedsReconnect = false;
    resetIdleTimer();
    return true;
    
  } catch (err) {
    console.error('[Supabase] 재연결 예외:', err);
    return false;
  }
}; 