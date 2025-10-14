/**
 * 환경별 로깅 유틸리티
 * 개발 환경에서만 로그 출력, 프로덕션에서는 에러만 출력
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * 일반 로그 (개발 환경에서만)
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * 정보 로그 (개발 환경에서만)
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * 경고 로그 (개발 환경에서만)
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * 에러 로그 (항상 출력)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * 디버그 로그 (개발 환경에서만)
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * 테이블 형식 로그 (개발 환경에서만)
   */
  table: (data) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * 그룹 시작 (개발 환경에서만)
   */
  group: (label) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * 그룹 종료 (개발 환경에서만)
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  }
};

export default logger;

