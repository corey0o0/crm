// API 설정 가져오기
const getApiConfig = () => {
  // 런타임 환경변수 사용
  if (window._env_) {
    return {
      ENDPOINT: window._env_.OPENAI_API_ENDPOINT,
      MODEL: window._env_.OPENAI_API_MODEL,
      API_KEY: window._env_.OPENAI_API_KEY
    };
  }
  
  // 폴백 설정 (개발 환경용)
  return {
    ENDPOINT: 'https://api.openai.com/v1/chat/completions',
    MODEL: 'gpt-4o-mini',
    API_KEY: ''  // 빈 문자열로 설정하여 API 키가 노출되지 않도록 함
  };
};

// API 엔드포인트 설정
export const API_CONFIG = {
  OPENAI: getApiConfig()
}; 