#!/bin/bash

# 백엔드 서버 설치 스크립트 (macOS/Linux)

echo "=========================================="
echo "백엔드 서버 설치를 시작합니다..."
echo "=========================================="

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo "Node.js를 먼저 설치해주세요: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 버전: $(node --version)"

# npm 설치 확인
if ! command -v npm &> /dev/null; then
    echo "❌ npm이 설치되어 있지 않습니다."
    exit 1
fi

echo "✅ npm 버전: $(npm --version)"

# 의존성 설치
echo ""
echo "📦 의존성 패키지를 설치합니다..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 의존성 설치에 실패했습니다."
    exit 1
fi

# Playwright 브라우저 설치
echo ""
echo "🌐 Playwright 브라우저를 설치합니다..."
npx playwright install chromium
npx playwright install-deps chromium

if [ $? -ne 0 ]; then
    echo "⚠️  Playwright 브라우저 설치에 실패했습니다. 나중에 수동으로 설치할 수 있습니다."
    echo "   실행: npx playwright install chromium"
fi

# .env 파일 확인
if [ ! -f .env ]; then
    echo ""
    echo "📝 .env 파일을 생성합니다..."
    cat > .env << EOF
PORT=5000
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLOUDMERSIVE_API_KEY=your_cloudmersive_api_key_here
EOF
    echo "✅ .env 파일이 생성되었습니다. API 키를 설정해주세요."
else
    echo "✅ .env 파일이 이미 존재합니다."
fi

echo ""
echo "=========================================="
echo "✅ 설치가 완료되었습니다!"
echo "=========================================="
echo ""
echo "서버를 실행하려면 다음 명령어를 사용하세요:"
echo "  npm start"
echo ""
echo "또는 start.sh 스크립트를 실행하세요:"
echo "  ./start.sh"
echo ""

