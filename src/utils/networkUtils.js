/**
 * 네트워크 관련 유틸리티 함수들
 * 안전한 재시도 로직과 오류 처리를 제공
 */

/**
 * 안전한 재시도 함수 (지수 백오프 적용)
 * @param {Function} fn - 실행할 함수
 * @param {Object} options - 재시도 옵션
 * @returns {Promise} 실행 결과
 */
export const safeRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    maxTime = 30000, // 30초 최대 시간
    baseDelay = 1000, // 1초 기본 지연
    maxDelay = 10000 // 10초 최대 지연
  } = options;
  
  const startTime = Date.now();
  console.log(`[NetworkUtils] safeRetry 시작 - maxRetries: ${maxRetries}, maxTime: ${maxTime}ms`);
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[NetworkUtils] 시도 ${attempt + 1}/${maxRetries}`);
      const result = await fn();
      console.log(`[NetworkUtils] 시도 ${attempt + 1} 성공`);
      return result;
    } catch (error) {
      console.log(`[NetworkUtils] 시도 ${attempt + 1} 실패:`, error.message);
      
      // 최대 시간 초과 체크
      if (Date.now() - startTime > maxTime) {
        console.log(`[NetworkUtils] 최대 시간 초과 (${maxTime}ms)`);
        throw new Error(`최대 재시도 시간 초과 (${maxTime}ms)`);
      }
      
      // 마지막 시도면 오류 던지기
      if (attempt === maxRetries - 1) {
        console.log(`[NetworkUtils] 최대 재시도 횟수 초과, 오류 던지기`);
        throw error;
      }
      
      // 지수 백오프 계산 (최대 지연 시간 제한)
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      console.log(`[NetworkUtils] 재시도 ${attempt + 1}/${maxRetries} (${delay}ms 후)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * 네트워크 오류 타입 판별
 * @param {Error} error - 오류 객체
 * @returns {string} 오류 타입
 */
export const getNetworkErrorType = (error) => {
  const message = error?.message || '';
  const name = error?.name || '';
  
  if (name === 'AbortError') return 'TIMEOUT';
  if (message.includes('Failed to fetch')) return 'NETWORK_ERROR';
  if (message.includes('401')) return 'UNAUTHORIZED';
  if (message.includes('403')) return 'FORBIDDEN';
  if (message.includes('500')) return 'SERVER_ERROR';
  
  return 'UNKNOWN';
};

/**
 * 재시도 가능한 오류인지 판별
 * @param {Error} error - 오류 객체
 * @param {number} attempt - 현재 시도 횟수
 * @returns {boolean} 재시도 가능 여부
 */
export const shouldRetry = (error, attempt = 0) => {
  if (attempt >= 3) return false; // 최대 3회
  
  const errorType = getNetworkErrorType(error);
  const retryableTypes = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'];
  
  return retryableTypes.includes(errorType);
};

/**
 * 사용자 친화적 오류 메시지 생성
 * @param {Error} error - 오류 객체
 * @returns {string} 오류 메시지
 */
export const getErrorMessage = (error) => {
  const errorType = getNetworkErrorType(error);
  
  switch (errorType) {
    case 'TIMEOUT':
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    case 'NETWORK_ERROR':
      return '네트워크 연결을 확인해주세요.';
    case 'UNAUTHORIZED':
      return '인증이 만료되었습니다. 다시 로그인해주세요.';
    case 'FORBIDDEN':
      return '접근 권한이 없습니다.';
    case 'SERVER_ERROR':
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    default:
      return '알 수 없는 오류가 발생했습니다.';
  }
};

/**
 * 오프라인 상태 감지
 * @returns {boolean} 오프라인 여부
 */
export const isOffline = () => {
  return !navigator.onLine;
};

/**
 * 연결 상태 모니터링
 * @param {Function} onOnline - 온라인 콜백
 * @param {Function} onOffline - 오프라인 콜백
 * @returns {Function} 정리 함수
 */
export const monitorConnection = (onOnline, onOffline) => {
  const handleOnline = () => {
    console.log('[NetworkUtils] 온라인 상태로 변경');
    onOnline?.();
  };
  
  const handleOffline = () => {
    console.log('[NetworkUtils] 오프라인 상태로 변경');
    onOffline?.();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};
