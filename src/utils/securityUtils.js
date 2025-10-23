/**
 * 보안 관련 유틸리티 함수들
 * API 키 보호, 민감한 정보 마스킹, 보안 헤더 관리
 */

/**
 * API 키 마스킹 (로깅용)
 * @param {string} apiKey - API 키
 * @param {number} visibleChars - 보여줄 문자 수 (기본 4)
 * @returns {string} 마스킹된 API 키
 */
export const maskApiKey = (apiKey, visibleChars = 4) => {
  if (!apiKey || apiKey.length < visibleChars) {
    return '***';
  }
  return apiKey.substring(0, visibleChars) + '*'.repeat(apiKey.length - visibleChars);
};

/**
 * 민감한 데이터 마스킹
 * @param {string} data - 마스킹할 데이터
 * @param {number} visibleChars - 보여줄 문자 수
 * @returns {string} 마스킹된 데이터
 */
export const maskSensitiveData = (data, visibleChars = 2) => {
  if (!data || data.length < visibleChars) {
    return '***';
  }
  return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
};

/**
 * 안전한 로깅 (민감한 정보 제외)
 * @param {string} message - 로그 메시지
 * @param {Object} data - 로그 데이터
 * @param {Array} sensitiveKeys - 민감한 키 목록
 */
export const safeLog = (message, data = {}, sensitiveKeys = ['password', 'token', 'key', 'secret']) => {
  const sanitizedData = { ...data };
  
  // 민감한 키 마스킹
  Object.keys(sanitizedData).forEach(key => {
    if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey))) {
      sanitizedData[key] = maskSensitiveData(sanitizedData[key]);
    }
  });
  
  console.log(message, sanitizedData);
};

/**
 * 보안 헤더 생성
 * @param {string} apiKey - API 키
 * @param {Object} additionalHeaders - 추가 헤더
 * @returns {Object} 보안 헤더
 */
export const createSecureHeaders = (apiKey, additionalHeaders = {}) => {
  return {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...additionalHeaders
  };
};

/**
 * URL에서 민감한 정보 제거
 * @param {string} url - URL
 * @returns {string} 정리된 URL
 */
export const sanitizeUrl = (url) => {
  try {
    const urlObj = new URL(url);
    // 쿼리 파라미터에서 민감한 정보 제거
    const sensitiveParams = ['token', 'key', 'secret', 'password'];
    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '***');
      }
    });
    return urlObj.toString();
  } catch (error) {
    return url;
  }
};

/**
 * localStorage 안전한 저장
 * @param {string} key - 키
 * @param {*} value - 값
 * @param {boolean} encrypt - 암호화 여부
 */
export const safeSetItem = (key, value, encrypt = false) => {
  try {
    const data = encrypt ? btoa(JSON.stringify(value)) : JSON.stringify(value);
    localStorage.setItem(key, data);
  } catch (error) {
    console.error('localStorage 저장 실패:', error);
  }
};

/**
 * localStorage 안전한 조회
 * @param {string} key - 키
 * @param {boolean} decrypt - 복호화 여부
 * @returns {*} 저장된 값
 */
export const safeGetItem = (key, decrypt = false) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    
    const parsed = decrypt ? JSON.parse(atob(data)) : JSON.parse(data);
    return parsed;
  } catch (error) {
    console.error('localStorage 조회 실패:', error);
    return null;
  }
};

/**
 * 민감한 데이터 정리
 */
export const clearSensitiveData = () => {
  const sensitiveKeys = [
    'rememberedEmail',
    'rememberMe',
    'temp_shipment_data',
    'serviceListFilters',
    'serviceListPage',
    'cache_'
  ];
  
  sensitiveKeys.forEach(key => {
    if (key === 'cache_') {
      // 캐시 키들 정리
      Object.keys(localStorage).forEach(storageKey => {
        if (storageKey.startsWith('cache_')) {
          localStorage.removeItem(storageKey);
        }
      });
    } else {
      localStorage.removeItem(key);
    }
  });
};
