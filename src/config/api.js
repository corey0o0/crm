// API 엔드포인트 설정
const getEnvVariable = (key, defaultValue = '') => {
  // 1. process.env에서 확인
  if (process.env[key]) {
    return process.env[key];
  }

  // 2. window._env_에서 확인
  if (window._env_ && window._env_[key]) {
    return window._env_[key];
  }

  // 3. 기본값 반환
  return defaultValue;
};

export const API_CONFIG = {
  OPENAI: {
    ENDPOINT: 'https://api.openai.com/v1/chat/completions',
    MODEL: getEnvVariable('REACT_APP_OPENAI_MODEL', 'gpt-4o-mini'),
    API_KEY: getEnvVariable('REACT_APP_OPENAI_API_KEY')
  },
  // 로컬 LLM (Ollama) 설정
  LOCAL_LLM: {
    ENABLED: getEnvVariable('REACT_APP_USE_LOCAL_LLM', 'false') === 'true',
    // 개발 환경에서는 프록시를 통해 접근 (CORS 문제 해결)
    ENDPOINT: process.env.NODE_ENV === 'development'
      ? '/__ollama/v1/chat/completions'
      : getEnvVariable('REACT_APP_LOCAL_LLM_ENDPOINT', 'http://localhost:11434/v1/chat/completions'),
    MODEL: getEnvVariable('REACT_APP_LOCAL_LLM_MODEL', 'llama3.2:latest'),
    API_KEY: null // 로컬 LLM은 API 키가 필요 없음
  }
}; 