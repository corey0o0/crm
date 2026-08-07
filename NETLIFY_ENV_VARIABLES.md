# Netlify 환경 변수 설정 가이드

> **📌 중요**: 이 문서는 Netlify 배포 시 필요한 환경 변수 "목록"만 정리한 것입니다.
> 실제 값은 여기에 적지 않습니다 — Netlify 대시보드(Site settings → Environment variables)에서만 확인하세요.

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
| **Cloudmarssive** | `REACT_APP_CLOUDMARSSIVE_API_KEY` | ⚪ | Cloudmarssive API 키 |

**범례**: ✅ 필수 | ⚪ 선택적 (기능 사용 시 필요)

---

## 🔑 설정 방법

1. **Netlify 대시보드 접속**
   - https://app.netlify.com 접속
   - 프로젝트 선택

2. **환경 변수 설정 페이지로 이동**
   - Site settings → Environment variables
   - 또는 Build & deploy → Environment → Environment variables

3. **변수 추가**
   - "Add a variable" 클릭
   - 위 표의 변수명을 입력하고, 값은 실제 발급받은 값으로 입력
   - Scope: "All scopes" 또는 "Production" 선택
   - "Save" 클릭

### Netlify CLI로 설정하는 경우

```bash
npm install -g netlify-cli
netlify login

# 값은 실제 발급받은 값으로 직접 채워서 실행 (이 문서에는 적지 않음)
netlify env:set REACT_APP_SUPABASE_URL "<값>"
netlify env:set REACT_APP_SUPABASE_ANON_KEY "<값>"
netlify env:set REACT_APP_TELEGRAM_BOT_TOKEN "<값>"
netlify env:set REACT_APP_TELEGRAM_CHAT_ID "<값>"
netlify env:set REACT_APP_GOOGLE_CLIENT_ID "<값>"
netlify env:set REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID "<값>"
netlify env:set REACT_APP_GOOGLE_DRIVE_SUBFOLDER "<값>"
netlify env:set REACT_APP_BASE_URL "<값>"
```

### 재배포

환경 변수를 추가/변경한 후:
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

- ✅ 환경 변수 **값**은 Netlify 대시보드에서만 관리하고, 문서나 커밋에는 절대 적지 않는다
- ✅ 팀원과 공유할 때는 Netlify의 "Share environment variables" 기능 사용
- ✅ 프로덕션과 스테이징 환경을 분리하여 관리
- ⚠️ `REACT_APP_` 접두사가 붙은 값은 빌드 시 **브라우저 번들에 그대로 인라인**된다.
  진짜 시크릿(서버 전용 키)은 이 접두사를 붙이지 말고 Netlify 함수(`netlify/functions/`)나
  서버(`server/`) 쪽 환경 변수로만 관리할 것.

## 📌 참고사항

- **환경 변수는 빌드 시점에 주입됩니다** - 변수 변경 후 재배포 필요
- **`REACT_APP_` 접두사 필수** - 이 접두사가 붙은 변수만 클라이언트에서 사용 가능
- **스코프 설정** - Production, Deploy previews, Branch deploys 중 선택 가능

## 🆘 문제 해결

### 환경 변수가 로드되지 않는 경우

1. Netlify Deploys → 최신 배포 → Build log 에서 주입 여부 확인
2. 브라우저 콘솔에서 `console.log(window._env_)` 로 확인
3. Deploys → Trigger deploy → Clear cache and deploy site 로 재배포

### 특정 변수가 작동하지 않는 경우

- 변수명에 `REACT_APP_` 접두사 확인
- 대소문자 정확히 일치하는지 확인
- 값에 따옴표나 공백이 없는지 확인
