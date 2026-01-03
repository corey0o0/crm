# 구글 클라이언트 ID 갱신 가이드

이 가이드는 Google OAuth 클라이언트 ID를 새로 생성하거나 업데이트하는 방법을 설명합니다.

## 📋 목차

1. [Google Cloud Console에서 클라이언트 ID 생성](#1-google-cloud-console에서-클라이언트-id-생성)
2. [애플리케이션에 클라이언트 ID 적용](#2-애플리케이션에-클라이언트-id-적용)
3. [기존 토큰 삭제 및 재인증](#3-기존-토큰-삭제-및-재인증)
4. [문제 해결](#4-문제-해결)

---

## 1. Google Cloud Console에서 클라이언트 ID 생성

### 1.1 Google Cloud Console 접속

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. Google 계정으로 로그인

### 1.2 프로젝트 선택 또는 생성

1. 상단의 프로젝트 선택 드롭다운 클릭
2. 기존 프로젝트 선택 또는 "새 프로젝트" 클릭하여 생성
   - 프로젝트 이름: 예) "CRM App"
   - 조직: 선택 사항

### 1.3 Google Drive API 활성화

1. 왼쪽 메뉴에서 **"API 및 서비스"** → **"라이브러리"** 클릭
2. 검색창에 "Google Drive API" 입력
3. **"Google Drive API"** 선택
4. **"사용"** 버튼 클릭하여 API 활성화

### 1.4 OAuth 동의 화면 설정

1. **"API 및 서비스"** → **"OAuth 동의 화면"** 클릭
2. 사용자 유형 선택:
   - **외부**: 일반 사용자도 사용 가능
   - **내부**: Google Workspace 조직 내부만 사용
3. 앱 정보 입력:
   - 앱 이름: 예) "CRM App"
   - 사용자 지원 이메일: 선택
   - 개발자 연락처 정보: 이메일 주소
4. **"저장 후 계속"** 클릭
5. 범위(Scopes) 설정:
   - **"범위 추가 또는 삭제"** 클릭
   - `https://www.googleapis.com/auth/drive.file` 선택
   - **"업데이트"** → **"저장 후 계속"** 클릭
6. 테스트 사용자 추가 (외부 앱인 경우):
   - **"사용자 추가"** 클릭
   - 테스트할 Google 계정 이메일 추가
   - **"저장 후 계속"** 클릭
7. 요약 확인 후 **"대시보드로 돌아가기"** 클릭

### 1.5 OAuth 2.0 클라이언트 ID 생성

1. **"API 및 서비스"** → **"사용자 인증 정보"** 클릭
2. 상단의 **"+ 사용자 인증 정보 만들기"** 클릭
3. **"OAuth 클라이언트 ID"** 선택
4. 애플리케이션 유형: **"웹 애플리케이션"** 선택
5. 이름 입력: 예) "CRM App Web Client"
6. **승인된 리디렉션 URI** 추가:
   ```
   http://localhost:3000/google-auth-callback.html
   https://crmapp8893.netlify.app/google-auth-callback.html
   ```
   
   ⚠️ **중요 사항**:
   - 쿼리 파라미터(`?service_id=*`)는 포함하지 마세요
   - 정확한 URI만 입력하세요 (슬래시 포함)
   - 개발 환경과 프로덕션 환경 모두 추가하세요
   
7. **"만들기"** 클릭
8. **클라이언트 ID 복사**:
   - 팝업에서 클라이언트 ID 복사
   - 형식: `숫자-문자열.apps.googleusercontent.com`
   - 예: `858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com`

---

## 2. 애플리케이션에 클라이언트 ID 적용

### 2.1 로컬 개발 환경 업데이트

**파일**: `public/env.js`

```javascript
window._env_ = {
  // ... 기존 설정 ...
  REACT_APP_GOOGLE_CLIENT_ID: '새로운_클라이언트_ID_여기에_붙여넣기',
  // ... 나머지 설정 ...
};
```

**업데이트 방법**:
1. `public/env.js` 파일 열기
2. `REACT_APP_GOOGLE_CLIENT_ID` 값 수정
3. 개발 서버 재시작:
   ```bash
   # 서버 중지 (Ctrl+C)
   npm start
   ```

### 2.2 Netlify 프로덕션 환경 업데이트

**방법 1: Netlify 대시보드에서 수정 (권장)**

1. [Netlify 대시보드](https://app.netlify.com/) 접속
2. 사이트 선택
3. **Site settings** → **Environment variables** 클릭
4. `REACT_APP_GOOGLE_CLIENT_ID` 찾기
5. **Edit** 클릭하여 새 클라이언트 ID로 수정
6. **Save** 클릭
7. **Deploys** 탭으로 이동
8. **Trigger deploy** → **Clear cache and deploy site** 클릭

**방법 2: Netlify CLI 사용**

```bash
# Netlify CLI 설치 (최초 1회)
npm install -g netlify-cli

# Netlify 로그인
netlify login

# 환경 변수 업데이트
netlify env:set REACT_APP_GOOGLE_CLIENT_ID "새로운_클라이언트_ID"

# 재배포
netlify deploy --prod
```

### 2.3 Google Cloud Console에서 리디렉션 URI 확인

새 클라이언트 ID를 생성했다면, 리디렉션 URI가 올바르게 설정되었는지 확인:

1. Google Cloud Console → **API 및 서비스** → **사용자 인증 정보**
2. 생성한 OAuth 2.0 클라이언트 ID 클릭
3. **승인된 리디렉션 URI** 확인:
   - ✅ `http://localhost:3000/google-auth-callback.html` (개발용)
   - ✅ `https://crmapp8893.netlify.app/google-auth-callback.html` (프로덕션용)
   - ❌ 쿼리 파라미터 없이 정확한 URI만 포함

---

## 3. 기존 토큰 삭제 및 재인증

클라이언트 ID를 변경한 후에는 기존에 저장된 액세스 토큰을 삭제하고 재인증해야 합니다.

### 3.1 브라우저에서 토큰 삭제

**방법 1: 브라우저 콘솔 사용 (권장)**

1. 브라우저 개발자 도구 열기 (F12)
2. **Console** 탭 선택
3. 다음 명령어 실행:
   ```javascript
   localStorage.removeItem('google_access_token');
   console.log('구글 액세스 토큰이 삭제되었습니다.');
   ```

**방법 2: Application 탭 사용**

1. 브라우저 개발자 도구 열기 (F12)
2. **Application** 탭 선택 (Chrome) 또는 **Storage** 탭 (Firefox)
3. 왼쪽 메뉴에서 **Local Storage** → 사이트 URL 클릭
4. `google_access_token` 키 찾기
5. 우클릭 → **Delete** 또는 키 선택 후 Delete 키 누르기

### 3.2 재인증

1. 토큰 삭제 후 애플리케이션 새로고침
2. 파일 업로드 기능 사용 시도
3. Google 인증 페이지로 자동 리디렉트됨
4. Google 계정 선택 및 권한 승인
5. 인증 완료 후 자동으로 원래 페이지로 돌아옴

---

## 4. 문제 해결

### 4.1 "redirect_uri_mismatch" 오류

**증상**:
```
Error 400: redirect_uri_mismatch
```

**원인**: Google Cloud Console에 등록된 리디렉션 URI와 실제 사용하는 URI가 일치하지 않음

**해결 방법**:
1. Google Cloud Console → **API 및 서비스** → **사용자 인증 정보**
2. OAuth 2.0 클라이언트 ID 클릭
3. **승인된 리디렉션 URI** 확인:
   - 정확한 URI가 등록되어 있는지 확인
   - 쿼리 파라미터가 없는지 확인
   - 슬래시(`/`) 포함 여부 확인
4. 필요시 URI 추가 또는 수정
5. **저장** 클릭

**올바른 예시**:
```
✅ http://localhost:3000/google-auth-callback.html
✅ https://crmapp8893.netlify.app/google-auth-callback.html
```

**잘못된 예시**:
```
❌ http://localhost:3000/google-auth-callback.html?service_id=123
❌ http://localhost:3000/google-auth-callback
❌ http://localhost:3000/google-auth-callback.html/
```

### 4.2 이전 클라이언트 ID가 계속 사용되는 경우

**증상**: 새 클라이언트 ID로 변경했는데도 이전 클라이언트 ID가 사용됨

**해결 방법**:

1. **브라우저 캐시 클리어**:
   - 하드 리프레시: `Ctrl + Shift + R` (Windows/Linux) 또는 `Cmd + Shift + R` (Mac)
   - 또는 개발자 도구 → Network 탭 → "Disable cache" 체크

2. **개발 서버 재시작**:
   ```bash
   # 서버 중지 (Ctrl+C)
   npm start
   ```

3. **환경 변수 확인**:
   브라우저 콘솔에서:
   ```javascript
   console.log('클라이언트 ID:', window._env_?.REACT_APP_GOOGLE_CLIENT_ID);
   ```
   올바른 클라이언트 ID가 표시되는지 확인

4. **빌드 폴더 삭제** (프로덕션):
   ```bash
   rm -rf build
   npm run build
   ```

### 4.3 "access_denied" 오류

**증상**: 인증 페이지에서 "access_denied" 오류 발생

**원인**: 
- OAuth 동의 화면이 아직 검토 중
- 테스트 사용자로 등록되지 않음 (외부 앱인 경우)

**해결 방법**:

1. **OAuth 동의 화면 확인**:
   - Google Cloud Console → **API 및 서비스** → **OAuth 동의 화면**
   - 게시 상태 확인
   - 외부 앱인 경우 "테스트 사용자"에 본인 이메일 추가

2. **앱 검토 요청** (필요한 경우):
   - OAuth 동의 화면에서 "앱 검토 요청" 클릭
   - 필요한 정보 입력 및 제출

### 4.4 클라이언트 ID가 undefined인 경우

**증상**: 콘솔에 "구글 클라이언트 ID가 설정되지 않았습니다" 오류

**해결 방법**:

1. **`public/env.js` 파일 확인**:
   ```javascript
   REACT_APP_GOOGLE_CLIENT_ID: '클라이언트_ID_여기',
   ```
   값이 올바르게 설정되어 있는지 확인

2. **브라우저 콘솔에서 확인**:
   ```javascript
   console.log('전체 환경 변수:', window._env_);
   console.log('클라이언트 ID:', window._env_?.REACT_APP_GOOGLE_CLIENT_ID);
   ```

3. **`env.js` 파일 로드 확인**:
   개발자 도구 → Network 탭 → 페이지 새로고침 → `env.js` 파일 확인
   - 파일이 로드되는지 확인
   - 응답 내용에 클라이언트 ID가 포함되어 있는지 확인

4. **`public/index.html` 확인**:
   ```html
   <script src="%PUBLIC_URL%/env.js"></script>
   ```
   이 스크립트 태그가 있는지 확인

---

## 5. 체크리스트

클라이언트 ID 갱신 후 다음을 확인하세요:

- [ ] Google Cloud Console에서 새 클라이언트 ID 생성 완료
- [ ] 승인된 리디렉션 URI 올바르게 설정됨
- [ ] `public/env.js`에 새 클라이언트 ID 업데이트 완료
- [ ] Netlify 환경 변수 업데이트 완료 (프로덕션)
- [ ] 브라우저에서 기존 토큰 삭제 완료
- [ ] 개발 서버 재시작 완료
- [ ] 브라우저 캐시 클리어 완료
- [ ] 파일 업로드 기능 테스트 완료
- [ ] Google 인증 정상 작동 확인

---

## 6. 참고 자료

- [Google OAuth 2.0 문서](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API 문서](https://developers.google.com/drive/api)
- [Netlify 환경 변수 가이드](./NETLIFY_ENV_VARIABLES.md)
- [토큰 업데이트 가이드](./TOKEN_UPDATE_GUIDE.md)

---

## 7. 현재 설정된 클라이언트 ID

**현재 클라이언트 ID** (2024년 기준):
```
858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com
```

**이전 클라이언트 ID** (더 이상 사용하지 않음):
```
291524102200-u2ogome9r6r99klqh6foslt26nj5ndmg.apps.googleusercontent.com
```

⚠️ **중요**: 클라이언트 ID를 변경한 후에는 반드시 기존 토큰을 삭제하고 재인증해야 합니다.
