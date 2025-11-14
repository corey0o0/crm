@echo off
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

