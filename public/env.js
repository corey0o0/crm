/**
 * 환경 변수 단일 소스 파일
 * 
 * ⚠️ 중요: 모든 환경 변수는 이 파일에서만 관리합니다.
 * 
 * 업데이트 방법:
 * 1. 이 파일에서 필요한 환경 변수 값 수정
 * 2. 개발 서버 재시작 (npm start)
 * 3. 프로덕션 빌드 시: npm run build
 * 
 * 텔레그램 봇 토큰 업데이트:
 * - TELEGRAM_BOT_UPDATE_GUIDE.md 파일 참조
 * 
 * 보안 주의:
 * - 이 파일에는 민감한 정보가 포함되어 있습니다
 * - Git에 커밋하지 않도록 주의하세요
 * 
 * 버전: 2024-12-29 (클라이언트 ID 업데이트)
 */
window._env_ = {
  REACT_APP_OPENAI_API_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
  REACT_APP_OPENAI_MODEL: 'gpt-4o-mini',
  REACT_APP_OPENAI_API_KEY: '',
  REACT_APP_SUPABASE_URL: 'https://fextlagqverlrajlmkon.supabase.co',
  REACT_APP_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4',
  REACT_APP_CLAUDE_API_KEY: '',
  REACT_APP_CLOUDMARSSIVE_API_KEY: '',
  REACT_APP_GOOGLE_CLIENT_ID: '858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com',
  REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID: '1bcCscOsNptDJvOVA1qSrbi-m6XU1y4d7',
  REACT_APP_GOOGLE_DRIVE_SUBFOLDER: 'upload_crm',
  REACT_APP_TELEGRAM_BOT_TOKEN: '1839298452:AAEWeDb5hUwvVcmWi3ueiUrTbajCSgypOeA',
  REACT_APP_TELEGRAM_CHAT_ID: '-4682658690',
  REACT_APP_BASE_URL: 'http://localhost:3000'
}; 