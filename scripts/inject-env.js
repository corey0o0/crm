const fs = require('fs');
const path = require('path');

// 빌드된 index.html 파일 경로
const indexPath = path.join(__dirname, '../build/index.html');

// 환경 변수 읽기
const env = process.env;

// index.html 파일 읽기
let html = fs.readFileSync(indexPath, 'utf8');

// 환경 변수 주입
Object.keys(env).forEach(key => {
  if (key.startsWith('REACT_APP_')) {
    const value = env[key] || '';
    html = html.replace(new RegExp(`%${key}%`, 'g'), value);
  }
});

// 수정된 파일 저장
fs.writeFileSync(indexPath, html); 