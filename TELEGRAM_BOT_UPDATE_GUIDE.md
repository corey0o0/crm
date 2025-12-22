# 텔레그램 봇 토큰 업데이트 가이드

## 📍 환경 변수 관리 위치

**모든 환경 변수는 `public/env.js` 파일 한 곳에서만 관리합니다.**

## 🔑 텔레그램 봇 토큰 업데이트 방법

### 1단계: 새 토큰 발급받기

1. **Telegram 앱 열기**
   - 모바일 또는 데스크톱 Telegram 앱 실행

2. **BotFather 찾기**
   - 검색창에서 `@BotFather` 검색
   - 공식 봇이므로 확인 마크(✓)가 있는 계정 선택

3. **토큰 재발급 요청**
   ```
   /token
   ```
   - BotFather에게 위 명령어 전송

4. **봇 선택**
   - 토큰을 재발급할 봇 선택
   - 봇 이름을 입력하거나 목록에서 선택

5. **새 토큰 받기**
   - BotFather가 새 토큰을 제공
   - 예: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### 2단계: 환경 변수 업데이트

1. **`public/env.js` 파일 열기**
   ```bash
   # 프로젝트 루트에서
   code public/env.js
   # 또는 직접 파일 편집
   ```

2. **토큰 값 수정**
   ```javascript
   window._env_ = {
     // ... 다른 변수들 ...
     REACT_APP_TELEGRAM_BOT_TOKEN: '새로운_토큰_여기에_입력',
     REACT_APP_TELEGRAM_CHAT_ID: '-4682658690', // 필요시 변경
     // ... 나머지 변수들 ...
   };
   ```

3. **파일 저장**

### 3단계: 앱 재시작

#### 개발 환경
```bash
# 개발 서버 중지 (Ctrl+C)
# 개발 서버 재시작
npm start
```

#### 프로덕션 빌드
```bash
# 빌드 재생성
npm run build

# 빌드된 파일 배포
```

### 4단계: 브라우저 캐시 클리어

- **Windows/Linux**: `Ctrl + Shift + R` 또는 `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`
- 또는 개발자 도구(F12) → Network 탭 → "Disable cache" 체크

## ✅ 확인 방법

1. **브라우저 콘솔 확인**
   - F12 → Console 탭
   - `[텔레그램] 환경 변수 상태:` 로그 확인
   - `tokenPrefix`가 새 토큰의 앞 10자리와 일치하는지 확인

2. **텔레그램 알림 테스트**
   - A/S 등록 또는 상태 변경 시도
   - 텔레그램 메시지 수신 확인

## ⚠️ 주의사항

1. **토큰 보안**
   - 토큰은 절대 공개 저장소(GitHub 등)에 커밋하지 마세요
   - `public/env.js`는 이미 `.gitignore`에 포함되어 있어야 합니다

2. **채팅 ID 확인**
   - 채팅 ID도 변경이 필요한 경우:
     - 봇에게 메시지 전송
     - `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` 접속
     - 응답에서 `chat.id` 확인

3. **토큰 형식**
   - 올바른 형식: `숫자:영문자와숫자조합`
   - 예: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

## 🔧 문제 해결

### 401 에러가 계속 발생하는 경우

1. **토큰이 올바르게 로드되었는지 확인**
   ```javascript
   // 브라우저 콘솔에서 실행
   console.log(window._env_.REACT_APP_TELEGRAM_BOT_TOKEN);
   ```

2. **토큰이 유효한지 확인**
   - BotFather에서 `/token` 명령으로 최신 토큰 확인
   - 토큰에 공백이나 특수문자가 포함되지 않았는지 확인

3. **봇 권한 확인**
   - 봇이 해당 채팅에 메시지를 보낼 권한이 있는지 확인
   - 봇에게 먼저 메시지를 보내서 대화를 시작해야 할 수 있습니다

## 📝 환경 변수 관리 원칙

- ✅ **단일 소스**: `public/env.js`만 수정
- ✅ **일관성**: 모든 환경 변수는 `public/env.js`에 정의
- ✅ **문서화**: 새로운 환경 변수 추가 시 이 가이드 업데이트

