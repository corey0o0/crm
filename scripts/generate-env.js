const fs = require('fs');
const path = require('path');

// 환경 변수 디버깅
console.log('현재 환경 변수:', {
  REACT_APP_OPENAI_API_KEY: process.env.REACT_APP_OPENAI_API_KEY ? '설정됨' : '설정되지 않음',
  REACT_APP_OPENAI_MODEL: process.env.REACT_APP_OPENAI_MODEL,
  NODE_ENV: process.env.NODE_ENV
});

// 환경 변수 템플릿
const envTemplate = `
window._env_ = {
  REACT_APP_OPENAI_API_ENDPOINT: '${process.env.REACT_APP_OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions'}',
  REACT_APP_OPENAI_MODEL: '${process.env.REACT_APP_OPENAI_MODEL || 'gpt-4o-mini'}',
  REACT_APP_OPENAI_API_KEY: '${process.env.REACT_APP_OPENAI_API_KEY || ''}',
  REACT_APP_SUPABASE_URL: '${process.env.REACT_APP_SUPABASE_URL || ''}',
  REACT_APP_SUPABASE_ANON_KEY: '${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}',
  REACT_APP_CLAUDE_API_KEY: '${process.env.REACT_APP_CLAUDE_API_KEY || ''}',
  REACT_APP_CLOUDMARSSIVE_API_KEY: '${process.env.REACT_APP_CLOUDMARSSIVE_API_KEY || ''}',
  REACT_APP_GOOGLE_CLIENT_ID: '${process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}',
  REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID: '${process.env.REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID || ''}',
  REACT_APP_GOOGLE_DRIVE_SUBFOLDER: '${process.env.REACT_APP_GOOGLE_DRIVE_SUBFOLDER || ''}',
  REACT_APP_TELEGRAM_BOT_TOKEN: '${process.env.REACT_APP_TELEGRAM_BOT_TOKEN || ''}',
  REACT_APP_TELEGRAM_CHAT_ID: '${process.env.REACT_APP_TELEGRAM_CHAT_ID || ''}',
  REACT_APP_BASE_URL: '${process.env.REACT_APP_BASE_URL || ''}'
};
`;

// build 디렉토리가 없으면 생성
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// env.js 파일 생성
fs.writeFileSync(path.join(buildDir, 'env.js'), envTemplate);

console.log('환경 변수 파일이 생성되었습니다.'); 