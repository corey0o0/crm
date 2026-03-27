/**
 * 오프라인/온라인 전환 시 데이터 동기화 유틸리티
 * 데이터 일관성 보장 및 충돌 해결
 */

import { setCache, getCache, isCacheValid } from './cacheUtils';
import { isOffline } from './networkUtils';

// 동기화 상태 관리
const syncState = {
  isOnline: navigator.onLine,
  pendingChanges: new Map(), // 오프라인 중 변경사항
  lastSyncTime: null,
  syncInProgress: false
};

/**
 * 온라인/오프라인 상태 변경 감지
 */
export const setupConnectionMonitoring = (onOnline, onOffline) => {
  const handleOnline = () => {
    console.log('[SyncUtils] 온라인 상태로 변경 - 동기화 시작');
    syncState.isOnline = true;
    syncState.lastSyncTime = Date.now();
    onOnline?.();
  };
  
  const handleOffline = () => {
    console.log('[SyncUtils] 오프라인 상태로 변경 - 로컬 모드 전환');
    syncState.isOnline = false;
    onOffline?.();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * 스마트 데이터 로딩 (캐시 우선, 네트워크 백업)
 * @param {string} cacheKey - 캐시 키
 * @param {Function} fetchFunction - 네트워크 데이터 가져오기 함수
 * @param {Object} options - 옵션
 * @returns {Promise<*>} 데이터
 */
export const smartLoad = async (cacheKey, fetchFunction, options = {}) => {
  const {
    ttl = 5 * 60 * 1000, // 5분 기본 TTL
    forceRefresh = false, // 강제 새로고침
    fallbackToCache = true, // 네트워크 실패 시 캐시 사용
    onCacheHit = null, // 캐시 히트 시 콜백
    onNetworkSuccess = null // 네트워크 성공 시 콜백
  } = options;

  try {
    // 1. 캐시 확인 (강제 새로고침이 아닌 경우)
    if (!forceRefresh && isCacheValid(cacheKey)) {
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        console.log(`[SyncUtils] 캐시에서 로딩: ${cacheKey}`);
        onCacheHit?.(cachedData);
        return cachedData;
      }
    }

    // 2. 오프라인 상태 체크
    if (isOffline()) {
      console.log(`[SyncUtils] 오프라인 상태 - 캐시 사용: ${cacheKey}`);
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        onCacheHit?.(cachedData);
        return cachedData;
      }
      console.warn(`[SyncUtils] 브라우저가 오프라인으로 표시되나 유효한 캐시가 없어 네트워크 요청을 시도합니다: ${cacheKey}`);
      // throw new Error('오프라인 상태이고 유효한 캐시가 없습니다.');
    }

    // 3. 네트워크에서 데이터 가져오기
    console.log(`[SyncUtils] 네트워크에서 로딩: ${cacheKey}`);
    const freshData = await fetchFunction();
    
    // 4. 성공 시 캐시 업데이트
    setCache(cacheKey, freshData, ttl);
    onNetworkSuccess?.(freshData);
    
    return freshData;
    
  } catch (error) {
    console.error(`[SyncUtils] 데이터 로딩 실패: ${cacheKey}`, error);
    
    // 5. 네트워크 실패 시 캐시 폴백
    if (fallbackToCache) {
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        console.log(`[SyncUtils] 네트워크 실패, 캐시 사용: ${cacheKey}`);
        onCacheHit?.(cachedData);
        return cachedData;
      }
    }
    
    throw error;
  }
};

/**
 * 오프라인 변경사항 추적
 * @param {string} key - 데이터 키
 * @param {*} data - 변경된 데이터
 * @param {string} operation - 작업 타입 (create, update, delete)
 */
export const trackOfflineChange = (key, data, operation) => {
  if (syncState.isOnline) {
    console.log(`[SyncUtils] 온라인 상태 - 즉시 동기화: ${key}`);
    return;
  }
  
  console.log(`[SyncUtils] 오프라인 변경사항 추적: ${key} (${operation})`);
  syncState.pendingChanges.set(key, {
    data,
    operation,
    timestamp: Date.now()
  });
};

/**
 * 온라인 복구 시 대기 중인 변경사항 동기화
 * @param {Function} syncFunction - 동기화 함수
 */
export const syncPendingChanges = async (syncFunction) => {
  if (syncState.syncInProgress) {
    console.log('[SyncUtils] 동기화 이미 진행 중');
    return;
  }
  
  if (syncState.pendingChanges.size === 0) {
    console.log('[SyncUtils] 동기화할 변경사항 없음');
    return;
  }
  
  syncState.syncInProgress = true;
  console.log(`[SyncUtils] ${syncState.pendingChanges.size}개 변경사항 동기화 시작`);
  
  try {
    const changes = Array.from(syncState.pendingChanges.entries());
    
    for (const [key, change] of changes) {
      try {
        await syncFunction(key, change.data, change.operation);
        console.log(`[SyncUtils] 동기화 완료: ${key}`);
        syncState.pendingChanges.delete(key);
      } catch (error) {
        console.error(`[SyncUtils] 동기화 실패: ${key}`, error);
        // 실패한 항목은 나중에 재시도
      }
    }
    
    console.log('[SyncUtils] 모든 변경사항 동기화 완료');
    
  } catch (error) {
    console.error('[SyncUtils] 동기화 중 오류:', error);
  } finally {
    syncState.syncInProgress = false;
  }
};

/**
 * 데이터 충돌 해결 (최신 데이터 우선)
 * @param {*} localData - 로컬 데이터
 * @param {*} remoteData - 원격 데이터
 * @param {string} timestampField - 타임스탬프 필드명
 * @returns {*} 해결된 데이터
 */
export const resolveDataConflict = (localData, remoteData, timestampField = 'updated_at') => {
  if (!localData || !remoteData) {
    return localData || remoteData;
  }
  
  const localTime = new Date(localData[timestampField] || 0).getTime();
  const remoteTime = new Date(remoteData[timestampField] || 0).getTime();
  
  if (localTime > remoteTime) {
    console.log('[SyncUtils] 로컬 데이터가 더 최신 - 로컬 데이터 사용');
    return localData;
  } else {
    console.log('[SyncUtils] 원격 데이터가 더 최신 - 원격 데이터 사용');
    return remoteData;
  }
};

/**
 * 캐시 무효화 (특정 키)
 * @param {string} cacheKey - 캐시 키
 */
export const invalidateCache = (cacheKey) => {
  try {
    const cacheKeyWithPrefix = `crm_cache_${cacheKey}`;
    localStorage.removeItem(cacheKeyWithPrefix);
    console.log(`[SyncUtils] 캐시 무효화: ${cacheKey}`);
  } catch (error) {
    console.warn('[SyncUtils] 캐시 무효화 실패:', error);
  }
};

/**
 * 관련 캐시 무효화 (패턴 매칭)
 * @param {string} pattern - 무효화할 캐시 패턴
 */
export const invalidateCachePattern = (pattern) => {
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => 
      key.startsWith('crm_cache_') && key.includes(pattern)
    );
    
    cacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`[SyncUtils] 패턴 캐시 무효화: ${pattern} (${cacheKeys.length}개)`);
  } catch (error) {
    console.warn('[SyncUtils] 패턴 캐시 무효화 실패:', error);
  }
};

/**
 * 동기화 상태 조회
 * @returns {Object} 동기화 상태
 */
export const getSyncStatus = () => {
  return {
    isOnline: syncState.isOnline,
    pendingChanges: syncState.pendingChanges.size,
    lastSyncTime: syncState.lastSyncTime,
    syncInProgress: syncState.syncInProgress
  };
};

/**
 * 대기 중인 변경사항 조회
 * @returns {Array} 대기 중인 변경사항 목록
 */
export const getPendingChanges = () => {
  return Array.from(syncState.pendingChanges.entries()).map(([key, change]) => ({
    key,
    operation: change.operation,
    timestamp: change.timestamp
  }));
};
