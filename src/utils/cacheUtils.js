/**
 * 간단한 캐싱 유틸리티
 * localStorage 기반 캐싱으로 오프라인 지원 및 성능 향상
 */

const CACHE_PREFIX = 'crm_cache_';
const MAX_CACHE_SIZE = 50; // 최대 50개 항목
const DEFAULT_TTL = 5 * 60 * 1000; // 5분 기본 TTL

/**
 * 캐시 항목 구조
 * @typedef {Object} CacheItem
 * @property {*} data - 캐시된 데이터
 * @property {number} timestamp - 캐시 생성 시간
 * @property {number} ttl - Time To Live (밀리초)
 * @property {string} key - 캐시 키
 */

/**
 * 캐시 데이터 저장
 * @param {string} key - 캐시 키
 * @param {*} data - 저장할 데이터
 * @param {number} ttl - TTL (밀리초, 기본 5분)
 */
export const setCache = (key, data, ttl = DEFAULT_TTL) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cacheItem = {
      data,
      timestamp: Date.now(),
      ttl,
      key
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    
    // 캐시 크기 제한 관리
    cleanOldCache();
    
    console.log(`[Cache] 데이터 캐시됨: ${key} (TTL: ${ttl}ms)`);
  } catch (error) {
    console.warn('[Cache] 캐시 저장 실패:', error);
  }
};

/**
 * 캐시 데이터 조회
 * @param {string} key - 캐시 키
 * @returns {*} 캐시된 데이터 또는 null
 */
export const getCache = (key) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    const cacheItem = JSON.parse(cached);
    const now = Date.now();
    
    // TTL 체크
    if (now - cacheItem.timestamp > cacheItem.ttl) {
      console.log(`[Cache] 캐시 만료됨: ${key}`);
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log(`[Cache] 캐시 히트: ${key}`);
    return cacheItem.data;
  } catch (error) {
    console.warn('[Cache] 캐시 조회 실패:', error);
    return null;
  }
};

/**
 * 캐시 데이터 삭제
 * @param {string} key - 캐시 키
 */
export const removeCache = (key) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    localStorage.removeItem(cacheKey);
    console.log(`[Cache] 캐시 삭제됨: ${key}`);
  } catch (error) {
    console.warn('[Cache] 캐시 삭제 실패:', error);
  }
};

/**
 * 모든 캐시 삭제
 */
export const clearAllCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('[Cache] 모든 캐시 삭제됨');
  } catch (error) {
    console.warn('[Cache] 전체 캐시 삭제 실패:', error);
  }
};

/**
 * 오래된 캐시 정리
 */
const cleanOldCache = () => {
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    if (cacheKeys.length <= MAX_CACHE_SIZE) {
      return;
    }
    
    // 캐시 항목들을 시간순으로 정렬
    const cacheItems = cacheKeys.map(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        return { key, timestamp: item.timestamp };
      } catch {
        return { key, timestamp: 0 };
      }
    }).sort((a, b) => a.timestamp - b.timestamp);
    
    // 오래된 항목들 삭제
    const toDelete = cacheItems.slice(0, cacheKeys.length - MAX_CACHE_SIZE);
    toDelete.forEach(({ key }) => {
      localStorage.removeItem(key);
    });
    
    console.log(`[Cache] ${toDelete.length}개 오래된 캐시 정리됨`);
  } catch (error) {
    console.warn('[Cache] 캐시 정리 실패:', error);
  }
};

/**
 * 캐시 상태 조회
 * @returns {Object} 캐시 통계
 */
export const getCacheStats = () => {
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();
    
    cacheKeys.forEach(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        totalSize += JSON.stringify(item).length;
        
        if (now - item.timestamp > item.ttl) {
          expiredCount++;
        }
      } catch {
        // 무시
      }
    });
    
    return {
      totalItems: cacheKeys.length,
      expiredItems: expiredCount,
      totalSize: `${Math.round(totalSize / 1024)}KB`,
      maxItems: MAX_CACHE_SIZE
    };
  } catch (error) {
    console.warn('[Cache] 캐시 통계 조회 실패:', error);
    return { totalItems: 0, expiredItems: 0, totalSize: '0KB', maxItems: MAX_CACHE_SIZE };
  }
};

/**
 * 캐시가 유효한지 확인
 * @param {string} key - 캐시 키
 * @returns {boolean} 유효 여부
 */
export const isCacheValid = (key) => {
  const cached = getCache(key);
  return cached !== null;
};

/**
 * 캐시 TTL 연장
 * @param {string} key - 캐시 키
 * @param {number} additionalTtl - 추가 TTL (밀리초)
 */
export const extendCacheTtl = (key, additionalTtl = DEFAULT_TTL) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const cacheItem = JSON.parse(cached);
      cacheItem.ttl += additionalTtl;
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      
      console.log(`[Cache] TTL 연장됨: ${key} (+${additionalTtl}ms)`);
    }
  } catch (error) {
    console.warn('[Cache] TTL 연장 실패:', error);
  }
};
