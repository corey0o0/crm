/**
 * 보안 강화된 로깅 시스템
 * 민감한 정보 마스킹 및 안전한 로깅
 */

import { maskApiKey, maskSensitiveData, sanitizeUrl } from './securityUtils';

/**
 * 보안 강화된 로깅 클래스
 */
class SecureLogger {
  constructor() {
    this.sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'auth', 'credential',
      'apikey', 'authorization', 'bearer', 'session', 'cookie'
    ];
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * 민감한 데이터 마스킹
   * @param {*} data - 마스킹할 데이터
   * @returns {*} 마스킹된 데이터
   */
  maskSensitiveData(data) {
    if (typeof data === 'string') {
      return maskSensitiveData(data);
    }
    
    if (typeof data === 'object' && data !== null) {
      const masked = { ...data };
      Object.keys(masked).forEach(key => {
        if (this.sensitiveKeys.some(sensitiveKey => 
          key.toLowerCase().includes(sensitiveKey))) {
          masked[key] = maskSensitiveData(masked[key]);
        }
      });
      return masked;
    }
    
    return data;
  }

  /**
   * 안전한 로그 출력
   * @param {string} level - 로그 레벨
   * @param {string} message - 메시지
   * @param {*} data - 데이터
   */
  log(level, message, data = null) {
    if (this.isProduction && level === 'debug') {
      return; // 프로덕션에서는 debug 로그 제외
    }

    const maskedData = data ? this.maskSensitiveData(data) : null;
    const timestamp = new Date().toISOString();
    
    console[level](`[${timestamp}] ${message}`, maskedData);
  }

  /**
   * 디버그 로그
   * @param {string} message - 메시지
   * @param {*} data - 데이터
   */
  debug(message, data = null) {
    this.log('debug', message, data);
  }

  /**
   * 정보 로그
   * @param {string} message - 메시지
   * @param {*} data - 데이터
   */
  info(message, data = null) {
    this.log('info', message, data);
  }

  /**
   * 경고 로그
   * @param {string} message - 메시지
   * @param {*} data - 데이터
   */
  warn(message, data = null) {
    this.log('warn', message, data);
  }

  /**
   * 오류 로그
   * @param {string} message - 메시지
   * @param {*} data - 데이터
   */
  error(message, data = null) {
    this.log('error', message, data);
  }

  /**
   * API 요청 로그
   * @param {string} method - HTTP 메서드
   * @param {string} url - URL
   * @param {Object} headers - 헤더
   * @param {*} body - 요청 본문
   */
  apiRequest(method, url, headers = {}, body = null) {
    this.debug('API 요청', {
      method,
      url: sanitizeUrl(url),
      headers: this.maskSensitiveData(headers),
      body: body ? this.maskSensitiveData(body) : null
    });
  }

  /**
   * API 응답 로그
   * @param {string} method - HTTP 메서드
   * @param {string} url - URL
   * @param {number} status - 상태 코드
   * @param {*} data - 응답 데이터
   */
  apiResponse(method, url, status, data = null) {
    this.debug('API 응답', {
      method,
      url: sanitizeUrl(url),
      status,
      data: data ? this.maskSensitiveData(data) : null
    });
  }

  /**
   * 인증 관련 로그
   * @param {string} action - 액션
   * @param {string} userId - 사용자 ID
   * @param {*} data - 데이터
   */
  auth(action, userId, data = null) {
    this.info(`인증 ${action}`, {
      userId: maskSensitiveData(userId),
      data: data ? this.maskSensitiveData(data) : null
    });
  }

  /**
   * 캐시 관련 로그
   * @param {string} action - 액션
   * @param {string} key - 캐시 키
   * @param {*} data - 데이터
   */
  cache(action, key, data = null) {
    this.debug(`캐시 ${action}`, {
      key: maskSensitiveData(key),
      data: data ? this.maskSensitiveData(data) : null
    });
  }

  /**
   * 네트워크 관련 로그
   * @param {string} action - 액션
   * @param {*} data - 데이터
   */
  network(action, data = null) {
    this.debug(`네트워크 ${action}`, {
      data: data ? this.maskSensitiveData(data) : null
    });
  }
}

// 싱글톤 인스턴스 생성
export const secureLogger = new SecureLogger();

// 편의 함수들
export const logDebug = (message, data) => secureLogger.debug(message, data);
export const logInfo = (message, data) => secureLogger.info(message, data);
export const logWarn = (message, data) => secureLogger.warn(message, data);
export const logError = (message, data) => secureLogger.error(message, data);
export const logApiRequest = (method, url, headers, body) => 
  secureLogger.apiRequest(method, url, headers, body);
export const logApiResponse = (method, url, status, data) => 
  secureLogger.apiResponse(method, url, status, data);
export const logAuth = (action, userId, data) => 
  secureLogger.auth(action, userId, data);
export const logCache = (action, key, data) => 
  secureLogger.cache(action, key, data);
export const logNetwork = (action, data) => 
  secureLogger.network(action, data);
