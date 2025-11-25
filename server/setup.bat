@echo off
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

if %errorlevel% neq 0 (
    echo [경고] Playwright 브라우저 설치에 실패했습니다.
    echo        나중에 수동으로 설치할 수 있습니다: npx playwright install chromium
) else (
    echo [확인] Playwright 브라우저 설치 완료
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

