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
  }
}; 