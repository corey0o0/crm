// API 엔드포인트 설정
export const API_CONFIG = {
  OPENAI: {
    ENDPOINT: 'https://api.openai.com/v1/chat/completions',
    MODEL: 'gpt-4o-mini',
    API_KEY: process.env.REACT_APP_OPENAI_API_KEY
  }
}; 