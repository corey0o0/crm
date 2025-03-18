const fs = require('fs');
const path = require('path');

// 현재 환경 변수 출력 (디버깅용)
console.log('Current environment variables:', {
  REACT_APP_OPENAI_API_KEY: process.env.REACT_APP_OPENAI_API_KEY ? 'exists' : 'missing',
  REACT_APP_OPENAI_MODEL: process.env.REACT_APP_OPENAI_MODEL || 'default'
});

// 환경 변수 템플릿
const envTemplate = `window._env_ = {
  REACT_APP_OPENAI_API_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
  REACT_APP_OPENAI_MODEL: '${process.env.REACT_APP_OPENAI_MODEL || 'gpt-4o-mini'}',
  REACT_APP_OPENAI_API_KEY: '${process.env.REACT_APP_OPENAI_API_KEY || ''}',
  REACT_APP_SUPABASE_URL: '${process.env.REACT_APP_SUPABASE_URL || ''}',
  REACT_APP_SUPABASE_ANON_KEY: '${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}',
  REACT_APP_CLAUDE_API_KEY: '${process.env.REACT_APP_CLAUDE_API_KEY || ''}',
  REACT_APP_CLOUDMARSSIVE_API_KEY: '${process.env.REACT_APP_CLOUDMARSSIVE_API_KEY || ''}'
};`;

// build 디렉토리 확인
const buildDir = path.join(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// env.js 파일 생성
fs.writeFileSync(
  path.join(buildDir, 'env.js'),
  envTemplate
);

console.log('Environment file generated successfully'); 