/**
 * 파일 다운로드 유틸리티 함수
 */

/**
 * 텍스트 파일을 다운로드
 * @param {string} content - 파일 내용
 * @param {string} filename - 파일명
 * @param {string} mimeType - MIME 타입 (기본값: 'text/plain')
 */
export const downloadTextFile = (content, filename, mimeType = 'text/plain') => {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 메모리 정리
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    return true;
  } catch (error) {
    console.error('파일 다운로드 중 오류:', error);
    throw error;
  }
};

/**
 * 백엔드 서버 설치 스크립트 다운로드
 * @param {string} platform - 'windows' | 'macos' | 'linux'
 */
export const downloadSetupScript = async (platform) => {
  try {
    let filename, content;
    
    if (platform === 'windows') {
      filename = 'setup.bat';
      content = `@echo off
REM 백엔드 서버 설치 스크립트 (Windows)

echo ==========================================
echo 백엔드 서버 설치를 시작합니다...
echo ==========================================

REM 현재 디렉토리로 이동
cd /d %~dp0

REM Node.js 설치 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo Node.js를 먼저 설치해주세요: https://nodejs.org/
    pause
    exit /b 1
)

echo [확인] Node.js 버전:
node --version

REM npm 설치 확인
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] npm이 설치되어 있지 않습니다.
    pause
    exit /b 1
)

echo [확인] npm 버전:
npm --version

REM 의존성 설치
echo.
echo [설치] 의존성 패키지를 설치합니다...
call npm install

if %errorlevel% neq 0 (
    echo [오류] 의존성 설치에 실패했습니다.
    pause
    exit /b 1
)

REM Playwright 브라우저 설치
echo.
echo [설치] Playwright 브라우저를 설치합니다...
call npx playwright install chromium
call npx playwright install-deps chromium

if %errorlevel% neq 0 (
    echo [경고] Playwright 브라우저 설치에 실패했습니다. 나중에 수동으로 설치할 수 있습니다.
    echo        실행: npx playwright install chromium
)

REM .env 파일 확인
if not exist .env (
    echo.
    echo [생성] .env 파일을 생성합니다...
    (
        echo PORT=5000
        echo ANTHROPIC_API_KEY=your_anthropic_api_key_here
        echo CLOUDMERSIVE_API_KEY=your_cloudmersive_api_key_here
    ) > .env
    echo [확인] .env 파일이 생성되었습니다. API 키를 설정해주세요.
) else (
    echo [확인] .env 파일이 이미 존재합니다.
)

echo.
echo ==========================================
echo [완료] 설치가 완료되었습니다!
echo ==========================================
echo.
echo 서버를 실행하려면 다음 명령어를 사용하세요:
echo   npm start
echo.
echo 또는 start.bat 스크립트를 실행하세요:
echo   start.bat
echo.
pause
`;
    } else {
      // macOS/Linux
      filename = 'setup.sh';
      content = `#!/bin/bash

# 백엔드 서버 설치 스크립트 (macOS/Linux)

echo "=========================================="
echo "백엔드 서버 설치를 시작합니다..."
echo "=========================================="

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
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
`;
    }
    
    downloadTextFile(content, filename, 'text/plain');
    return { success: true, filename };
  } catch (error) {
    console.error('설치 스크립트 다운로드 중 오류:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 백엔드 서버 실행 스크립트 다운로드
 * @param {string} platform - 'windows' | 'macos' | 'linux'
 */
export const downloadStartScript = async (platform) => {
  try {
    let filename, content;
    
    if (platform === 'windows') {
      filename = 'start.bat';
      content = `@echo off
REM 백엔드 서버 실행 스크립트 (Windows)

cd /d %~dp0

REM Node.js 설치 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo Node.js를 먼저 설치해주세요: https://nodejs.org/
    pause
    exit /b 1
)

REM node_modules 확인
if not exist "node_modules" (
    echo [설치] 의존성이 설치되지 않았습니다. 설치를 시작합니다...
    call npm install
)

REM .env 파일 확인
if not exist .env (
    echo [경고] .env 파일이 없습니다. 기본 설정으로 생성합니다...
    (
        echo PORT=5000
        echo ANTHROPIC_API_KEY=your_anthropic_api_key_here
        echo CLOUDMERSIVE_API_KEY=your_cloudmersive_api_key_here
    ) > .env
    echo [확인] .env 파일이 생성되었습니다. API 키를 설정해주세요.
)

echo.
echo [시작] 백엔드 서버를 시작합니다...
echo 서버 주소: http://localhost:5000
echo 종료하려면 Ctrl+C를 누르세요.
echo.

call npm start
`;
    } else {
      // macOS/Linux
      filename = 'start.sh';
      content = `#!/bin/bash

# 백엔드 서버 실행 스크립트 (macOS/Linux)

SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
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
`;
    }
    
    downloadTextFile(content, filename, 'text/plain');
    return { success: true, filename };
  } catch (error) {
    console.error('실행 스크립트 다운로드 중 오류:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 사용자 플랫폼 감지
 * @returns {string} 'windows' | 'macos' | 'linux'
 */
export const detectPlatform = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const platform = navigator.platform || '';
  
  if (/win/i.test(platform) || /win/i.test(userAgent)) {
    return 'windows';
  } else if (/mac/i.test(platform) || /mac/i.test(userAgent)) {
    return 'macos';
  } else {
    return 'linux';
  }
};

