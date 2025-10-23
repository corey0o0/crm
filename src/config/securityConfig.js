/**
 * 보안 설정 관리
 * 환경별 보안 정책을 중앙에서 관리
 */

// 환경별 보안 설정
const securityConfig = {
  development: {
    // 개발 환경: 관대한 설정
    forceHTTPS: false,
    tokenRefreshThreshold: 60000, // 60초
    rateLimiting: {
      enabled: false,
      requests: 1000,
      window: 60000
    },
    inputValidation: {
      strict: false,
      allowedChars: 'all'
    },
    logging: {
      level: 'debug',
      maskSensitive: true
    },
    cache: {
      encrypt: false,
      ttl: 5 * 60 * 1000 // 5분
    }
  },
  
  production: {
    // 프로덕션 환경: 엄격한 설정
    forceHTTPS: true,
    tokenRefreshThreshold: 30000, // 30초
    rateLimiting: {
      enabled: true,
      requests: 100,
      window: 60000
    },
    inputValidation: {
      strict: true,
      allowedChars: 'alphanumeric_korean_basic'
    },
    logging: {
      level: 'info',
      maskSensitive: true
    },
    cache: {
      encrypt: true,
      ttl: 2 * 60 * 1000 // 2분
    }
  }
};

// 현재 환경 설정 가져오기
const getCurrentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return securityConfig[env] || securityConfig.development;
};

// 보안 기능 활성화 여부 확인
export const isSecurityFeatureEnabled = (feature) => {
  const config = getCurrentConfig();
  
  switch (feature) {
    case 'forceHTTPS':
      return config.forceHTTPS;
    case 'rateLimiting':
      return config.rateLimiting.enabled;
    case 'strictValidation':
      return config.inputValidation.strict;
    case 'cacheEncryption':
      return config.cache.encrypt;
    default:
      return false;
  }
};

// 보안 설정 값 가져오기
export const getSecurityConfig = (key) => {
  const config = getCurrentConfig();
  
  const keyMap = {
    'tokenRefreshThreshold': config.tokenRefreshThreshold,
    'rateLimitRequests': config.rateLimiting.requests,
    'rateLimitWindow': config.rateLimiting.window,
    'allowedChars': config.inputValidation.allowedChars,
    'logLevel': config.logging.level,
    'cacheTTL': config.cache.ttl
  };
  
  return keyMap[key] || null;
};

// 보안 설정 검증
export const validateSecurityConfig = () => {
  const config = getCurrentConfig();
  const warnings = [];
  
  // 개발 환경에서 프로덕션 설정 사용 경고
  if (process.env.NODE_ENV === 'development') {
    if (config.forceHTTPS) {
      warnings.push('개발 환경에서 HTTPS 강제가 활성화되어 있습니다.');
    }
    if (config.rateLimiting.enabled) {
      warnings.push('개발 환경에서 Rate Limiting이 활성화되어 있습니다.');
    }
  }
  
  // 프로덕션 환경에서 개발 설정 사용 경고
  if (process.env.NODE_ENV === 'production') {
    if (!config.forceHTTPS) {
      warnings.push('프로덕션 환경에서 HTTPS 강제가 비활성화되어 있습니다.');
    }
    if (!config.rateLimiting.enabled) {
      warnings.push('프로덕션 환경에서 Rate Limiting이 비활성화되어 있습니다.');
    }
    if (!config.cache.encrypt) {
      warnings.push('프로덕션 환경에서 캐시 암호화가 비활성화되어 있습니다.');
    }
  }
  
  return warnings;
};

// 보안 설정 로깅
export const logSecurityConfig = () => {
  const config = getCurrentConfig();
  const warnings = validateSecurityConfig();
  
  console.log('[Security] 현재 보안 설정:', {
    environment: process.env.NODE_ENV,
    forceHTTPS: config.forceHTTPS,
    rateLimiting: config.rateLimiting.enabled,
    strictValidation: config.inputValidation.strict,
    cacheEncryption: config.cache.encrypt
  });
  
  if (warnings.length > 0) {
    console.warn('[Security] 보안 설정 경고:', warnings);
  }
};

export default getCurrentConfig;
