# Netlify 환경 변수 설정 가이드

> **📌 중요**: 이 문서는 Netlify 배포 시 필요한 모든 환경 변수를 정리한 것입니다.  
> 로컬 개발 환경은 `public/env.js` 파일을 참조하세요.

## 📋 Netlify 환경 변수 전체 목록

### 빠른 참조 테이블

| 카테고리 | 변수명 | 필수 | 설명 |
|---------|--------|------|------|
| **Supabase** | `REACT_APP_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| **Supabase** | `REACT_APP_SUPABASE_ANON_KEY` | ✅ | Supabase 익명 키 |
| **Telegram** | `REACT_APP_TELEGRAM_BOT_TOKEN` | ✅ | 텔레그램 봇 토큰 |
| **Telegram** | `REACT_APP_TELEGRAM_CHAT_ID` | ✅ | 텔레그램 채팅 ID |
| **Google** | `REACT_APP_GOOGLE_CLIENT_ID` | ✅ | Google OAuth 클라이언트 ID |
| **Google** | `REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID` | ✅ | Google Drive 루트 폴더 ID |
| **Google** | `REACT_APP_GOOGLE_DRIVE_SUBFOLDER` | ✅ | Google Drive 서브폴더명 |
| **Base** | `REACT_APP_BASE_URL` | ✅ | 앱 기본 URL (프로덕션 도메인) |
| **OpenAI** | `REACT_APP_OPENAI_API_ENDPOINT` | ⚪ | OpenAI API 엔드포인트 |
| **OpenAI** | `REACT_APP_OPENAI_MODEL` | ⚪ | OpenAI 모델명 |
| **OpenAI** | `REACT_APP_OPENAI_API_KEY` | ⚪ | OpenAI API 키 |
| **Claude** | `REACT_APP_CLAUDE_API_KEY` | ⚪ | Claude API 키 |
| **Cloudmarssive** | `REACT_APP_CLOUDMARSSIVE_API_KEY` | ⚪ | Cloudmarssive API 키 |

**범례**: ✅ 필수 | ⚪ 선택적 (기능 사용 시 필요)

---

## 🔑 필수 환경 변수 상세

Netlify 대시보드에서 다음 환경 변수들을 반드시 설정하세요.

### 설정 방법

1. **Netlify 대시보드 접속**
   - https://app.netlify.com 접속
   - 프로젝트 선택

2. **환경 변수 설정 페이지로 이동**
   - Site settings → Environment variables
   - 또는 Build & deploy → Environment → Environment variables

3. **변수 추가**
   - "Add a variable" 클릭
   - 아래 변수명과 값을 입력

---

## 🔑 필수 환경 변수

### Supabase 설정
```
변수명: REACT_APP_SUPABASE_URL
값: https://fextlagqverlrajlmkon.supabase.co
```

```
변수명: REACT_APP_SUPABASE_ANON_KEY
값: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4
```

### 텔레그램 설정
```
변수명: REACT_APP_TELEGRAM_BOT_TOKEN
값: 1839298452:AAEWeDb5hUwvVcmWi3ueiUrTbajCSgypOeA
```

```
변수명: REACT_APP_TELEGRAM_CHAT_ID
값: -4682658690
```

### Google 설정
```
변수명: REACT_APP_GOOGLE_CLIENT_ID
값: 958057206007-6u2noksta8rli4009kojoh884n57l7j1.apps.googleusercontent.com
```

```
변수명: REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID
값: 1bcCscOsNptDJvOVA1qSrbi-m6XU1y4d7
```

```
변수명: REACT_APP_GOOGLE_DRIVE_SUBFOLDER
값: upload_crm
```

### Base URL 설정
```
변수명: REACT_APP_BASE_URL
값: https://your-site-name.netlify.app
```
⚠️ **주의**: `your-site-name`을 실제 Netlify 사이트 이름으로 변경하세요.

---

## 🔧 선택적 환경 변수

### OpenAI 설정 (사용하는 경우)
```
변수명: REACT_APP_OPENAI_API_ENDPOINT
값: https://api.openai.com/v1/chat/completions
```

```
변수명: REACT_APP_OPENAI_MODEL
값: gpt-4o-mini
```

```
변수명: REACT_APP_OPENAI_API_KEY
값: (OpenAI API 키 입력)
```

### Claude 설정 (사용하는 경우)
```
변수명: REACT_APP_CLAUDE_API_KEY
값: (Claude API 키 입력)
```

### Cloudmarssive 설정 (사용하는 경우)
```
변수명: REACT_APP_CLOUDMARSSIVE_API_KEY
값: (Cloudmarssive API 키 입력)
```

---

## 📝 Netlify 환경 변수 일괄 설정

### 방법 1: Netlify UI에서 개별 추가 (권장)

각 변수를 하나씩 추가하는 것이 가장 안전합니다.

### 방법 2: Netlify CLI 사용

터미널에서 다음 명령어로 일괄 설정:

```bash
# Netlify CLI 설치 (최초 1회)
npm install -g netlify-cli

# Netlify 로그인
netlify login

# 환경 변수 설정
netlify env:set REACT_APP_SUPABASE_URL "https://fextlagqverlrajlmkon.supabase.co"
netlify env:set REACT_APP_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4"
netlify env:set REACT_APP_TELEGRAM_BOT_TOKEN "1839298452:AAEWeDb5hUwvVcmWi3ueiUrTbajCSgypOeA"
netlify env:set REACT_APP_TELEGRAM_CHAT_ID "-4682658690"
netlify env:set REACT_APP_GOOGLE_CLIENT_ID "958057206007-6u2noksta8rli4009kojoh884n57l7j1.apps.googleusercontent.com"
netlify env:set REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID "1bcCscOsNptDJvOVA1qSrbi-m6XU1y4d7"
netlify env:set REACT_APP_GOOGLE_DRIVE_SUBFOLDER "upload_crm"
netlify env:set REACT_APP_BASE_URL "https://your-site-name.netlify.app"
```

### 방법 3: .env 파일로 일괄 가져오기

`.env.netlify` 파일 생성 후 Netlify CLI로 가져오기:

```bash
# .env.netlify 파일 생성
cat > .env.netlify << EOF
REACT_APP_SUPABASE_URL=https://fextlagqverlrajlmkon.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4
REACT_APP_TELEGRAM_BOT_TOKEN=1839298452:AAEWeDb5hUwvVcmWi3ueiUrTbajCSgypOeA
REACT_APP_TELEGRAM_CHAT_ID=-4682658690
REACT_APP_GOOGLE_CLIENT_ID=958057206007-6u2noksta8rli4009kojoh884n57l7j1.apps.googleusercontent.com
REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID=1bcCscOsNptDJvOVA1qSrbi-m6XU1y4d7
REACT_APP_GOOGLE_DRIVE_SUBFOLDER=upload_crm
REACT_APP_BASE_URL=https://your-site-name.netlify.app
EOF

# Netlify에 가져오기
netlify env:import .env.netlify
```

---

## ⚙️ Netlify 설정 단계

### 1. 환경 변수 추가
1. Netlify 대시보드 → Site settings
2. Build & deploy → Environment
3. "Edit variables" 클릭
4. 각 변수를 하나씩 추가:
   - Key: 변수명 (예: `REACT_APP_SUPABASE_URL`)
   - Value: 값 (예: `https://fextlagqverlrajlmkon.supabase.co`)
   - Scope: "All scopes" 또는 "Production" 선택
5. "Save" 클릭

### 2. 빌드 설정 확인
`netlify.toml` 파일이 올바르게 설정되어 있는지 확인:
```toml
[build]
  command = "npm install && npm run build"
  publish = "build"
```

### 3. 재배포
환경 변수를 추가한 후:
1. "Deploys" 탭으로 이동
2. "Trigger deploy" → "Clear cache and deploy site" 클릭
3. 빌드 완료 대기

---

## ✅ 확인 방법

배포 후 브라우저 콘솔에서 확인:
```javascript
// 개발자 도구(F12) → Console 탭
console.log(window._env_);
```

모든 환경 변수가 올바르게 로드되었는지 확인하세요.

---

## 🔒 보안 주의사항

- ✅ 환경 변수는 Netlify 대시보드에서만 관리
- ✅ 민감한 정보는 절대 Git에 커밋하지 않음
- ✅ 팀원과 공유할 때는 Netlify의 "Share environment variables" 기능 사용
- ✅ 프로덕션과 스테이징 환경을 분리하여 관리

---

## 📌 참고사항

- **환경 변수는 빌드 시점에 주입됩니다** - 변수 변경 후 재배포 필요
- **`REACT_APP_` 접두사 필수** - 이 접두사가 붙은 변수만 클라이언트에서 사용 가능
- **`REACT_APP_BASE_URL` 주의** - 실제 Netlify 사이트 URL로 변경 필수
- **스코프 설정** - Production, Deploy previews, Branch deploys 중 선택 가능
- **변수 우선순위**: Netlify 환경 변수 > `public/env.js` (빌드 시)

## 🔄 환경 변수 동기화

로컬 개발 환경(`public/env.js`)과 Netlify 환경 변수를 동기화하려면:

1. `public/env.js`에서 값 확인
2. Netlify 대시보드에서 동일한 값으로 설정
3. 재배포

## 📚 관련 문서

- [텔레그램 봇 토큰 업데이트 가이드](./TELEGRAM_BOT_UPDATE_GUIDE.md)
- [환경 변수 관리 원칙](./public/env.js) - 파일 상단 주석 참조

## 🆘 문제 해결

### 환경 변수가 로드되지 않는 경우

1. **빌드 로그 확인**
   - Netlify Deploys → 최신 배포 → Build log
   - 환경 변수 주입 여부 확인

2. **브라우저 콘솔 확인**
   ```javascript
   console.log(window._env_);
   ```

3. **재배포**
   - Deploys → Trigger deploy → Clear cache and deploy site

### 특정 변수가 작동하지 않는 경우

- 변수명에 `REACT_APP_` 접두사 확인
- 대소문자 정확히 일치하는지 확인
- 값에 따옴표나 공백이 없는지 확인

