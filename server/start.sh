#!/bin/bash

# 백엔드 서버 실행 스크립트 (macOS/Linux)

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo "Node.js를 먼저 설치해주세요: https://nodejs.org/"
    exit 1
fi

# node_modules 확인
if [ ! -d "node_modules" ]; then
    echo "📦 의존성이 설치되지 않았습니다. 설치를 시작합니다..."
    npm install
fi

# .env 파일 확인
if [ ! -f .env ]; then
    echo "⚠️  .env 파일이 없습니다. 기본 설정으로 생성합니다..."
    cat > .env << EOF
PORT=5000
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLOUDMERSIVE_API_KEY=your_cloudmersive_api_key_here
EOF
    echo "✅ .env 파일이 생성되었습니다. API 키를 설정해주세요."
fi

echo "🚀 백엔드 서버를 시작합니다..."
echo "서버 주소: http://localhost:5000"
echo "종료하려면 Ctrl+C를 누르세요."
echo ""

npm start

