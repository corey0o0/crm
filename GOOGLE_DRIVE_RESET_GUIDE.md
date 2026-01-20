# 구글 드라이브 재설정 가이드

구글 드라이브 연동이 제대로 작동하지 않을 때 전체적으로 재설정하는 방법입니다.

## 📋 목차

1. [문제 진단](#1-문제-진단)
2. [환경 변수 확인 및 수정](#2-환경-변수-확인-및-수정)
3. [Google Cloud Console 설정 확인](#3-google-cloud-console-설정-확인)
4. [브라우저 캐시 및 토큰 삭제](#4-브라우저-캐시-및-토큰-삭제)
5. [코드 확인](#5-코드-확인)
6. [테스트 및 검증](#6-테스트-및-검증)

---

## 1. 문제 진단

### 1.1 브라우저 콘솔에서 확인

브라우저 개발자 도구(F12) → Console 탭에서 다음 명령어 실행:

```javascript
// 환경 변수 전체 확인
console.log('전체 환경 변수:', window._env_);

// 구글 드라이브 관련 환경 변수 확인
console.log('클라이언트 ID:', window._env_?.REACT_APP_GOOGLE_CLIENT_ID);
console.log('루트 폴더 ID:', window._env_?.REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID);
console.log('서브폴더명:', window._env_?.REACT_APP_GOOGLE_DRIVE_SUBFOLDER);

// 저장된 토큰 확인
console.log('저장된 토큰:', localStorage.getItem('google_access_token'));
```

### 1.2 예상 결과

**올바른 클라이언트 ID**:
```
858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com
```

**이전 클라이언트 ID (사용하지 않음)**:
```
291524102200-u2ogome9r6r99klqh6foslt26nj5ndmg.apps.googleusercontent.com
```

---

## 2. 환경 변수 확인 및 수정

### 2.1 `public/env.js` 파일 확인

**파일 위치**: `public/env.js`

**올바른 설정**:
```javascript
window._env_ = {
  // ... 기타 설정 ...
  REACT_APP_GOOGLE_CLIENT_ID: '858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com',
  REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID: '1bcCscOsNptDJvOVA1qSrbi-m6XU1y4d7',
  REACT_APP_GOOGLE_DRIVE_SUBFOLDER: 'upload_crm',
  // ... 기타 설정 ...
};
```

**⚠️ 주의사항**:
- `REACT_APP_GOGLE_DRIVE_SUBFOLDER` (오타) ❌
- `REACT_APP_GOOGLE_DRIVE_SUBFOLDER` (올바름) ✅

### 2.2 `public/index.html` 확인

**파일 위치**: `public/index.html`

**확인 사항**:
1. `env.js` 파일이 올바르게 로드되는지:
   ```html
   <script src="%PUBLIC_URL%/env.js?v=20241229"></script>
   ```

2. 환경 변수 병합 로직이 있는지:
   ```html
   <script>
     // ... getBuildTimeValue 함수 ...
     REACT_APP_GOOGLE_CLIENT_ID: getBuildTimeValue('%REACT_APP_GOOGLE_CLIENT_ID%', 'REACT_APP_GOOGLE_CLIENT_ID'),
     REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID: getBuildTimeValue('%REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID%', 'REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID'),
     REACT_APP_GOOGLE_DRIVE_SUBFOLDER: getBuildTimeValue('%REACT_APP_GOOGLE_DRIVE_SUBFOLDER%', 'REACT_APP_GOOGLE_DRIVE_SUBFOLDER'),
   </script>
   ```

### 2.3 Netlify 환경 변수 확인 (프로덕션)

1. [Netlify 대시보드](https://app.netlify.com/) 접속
2. 사이트 선택 → **Site settings** → **Environment variables**
3. 다음 변수 확인:
   - `REACT_APP_GOOGLE_CLIENT_ID`
   - `REACT_APP_GOOGLE_DRIVE_ROOT_FOLDER_ID`
   - `REACT_APP_GOOGLE_DRIVE_SUBFOLDER`

---

## 3. Google Cloud Console 설정 확인

### 3.1 프로젝트 및 API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. **API 및 서비스** → **라이브러리**
4. **Google Drive API** 활성화 확인

### 3.2 OAuth 동의 화면 확인

1. **API 및 서비스** → **OAuth 동의 화면**
2. 게시 상태 확인:
   - **테스트 중**: 테스트 사용자만 사용 가능
   - **프로덕션**: 모든 사용자 사용 가능
3. 범위(Scopes) 확인:
   - `https://www.googleapis.com/auth/drive.file` 포함되어야 함

### 3.3 OAuth 2.0 클라이언트 ID 확인

1. **API 및 서비스** → **사용자 인증 정보**
2. OAuth 2.0 클라이언트 ID 찾기:
   - 클라이언트 ID: `858601328382-kpeaafkvvqaepgii0e79riruh8c642ei`
3. 클릭하여 상세 정보 확인
4. **승인된 리디렉션 URI** 확인:
   ```
   http://localhost:3000/google-auth-callback.html
   https://crmapp8893.netlify.app/google-auth-callback.html
   ```
   
   ⚠️ **중요**:
   - 쿼리 파라미터(`?service_id=*`) 포함하지 않기
   - 정확한 URI만 입력
   - 슬래시(`/`) 포함 여부 확인

### 3.4 새 클라이언트 ID 생성 (필요한 경우)

기존 클라이언트 ID에 문제가 있으면 새로 생성:

1. **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 이름 입력
5. 승인된 리디렉션 URI 추가
6. **만들기** 클릭
7. 클라이언트 ID 복사
8. `public/env.js` 파일에 업데이트

---

## 4. 브라우저 캐시 및 토큰 삭제

### 4.1 저장된 토큰 삭제

**방법 1: 브라우저 콘솔 사용 (권장)**

```javascript
// 구글 액세스 토큰 삭제
localStorage.removeItem('google_access_token');
console.log('✅ 구글 액세스 토큰이 삭제되었습니다.');

// 페이지 새로고침
location.reload();
```

**방법 2: Application 탭 사용**

1. 개발자 도구 열기 (F12)
2. **Application** 탭 (Chrome) 또는 **Storage** 탭 (Firefox)
3. **Local Storage** → 사이트 URL 클릭
4. `google_access_token` 키 찾기
5. 우클릭 → **Delete** 또는 키 선택 후 Delete 키 누르기

### 4.2 브라우저 캐시 클리어

**방법 1: 하드 리프레시**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**방법 2: 개발자 도구 사용**
1. 개발자 도구 열기 (F12)
2. **Network** 탭 선택
3. **"Disable cache"** 체크
4. 페이지 새로고침 (F5)

**방법 3: Application 탭에서 전체 삭제**
1. 개발자 도구 열기 (F12)
2. **Application** 탭 선택
3. **Clear storage** 또는 **Clear site data** 클릭
4. **Clear site data** 버튼 클릭
5. 페이지 새로고침

### 4.3 시크릿 모드에서 테스트

캐시 없이 테스트:
- **Chrome/Edge**: `Ctrl + Shift + N` (Windows) / `Cmd + Shift + N` (Mac)
- **Firefox**: `Ctrl + Shift + P` (Windows) / `Cmd + Shift + P` (Mac)
- **Safari**: `Cmd + Shift + N`

---

## 5. 코드 확인

### 5.1 빌드 폴더 삭제

이전 빌드 파일에 이전 클라이언트 ID가 하드코딩되어 있을 수 있습니다:

```bash
# 빌드 폴더 삭제
rm -rf build
```

### 5.2 개발 서버 재시작

```bash
# 개발 서버 중지 (Ctrl+C)
# 개발 서버 재시작
npm start
```

### 5.3 코드에서 환경 변수 사용 확인

**파일**: `src/components/Service/ServiceDetail.jsx`, `src/components/Service/AddService.jsx`

**올바른 사용법**:
```javascript
const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || 
                 (typeof window !== 'undefined' && window._env_ && window._env_.REACT_APP_GOOGLE_CLIENT_ID);
```

---

## 6. 테스트 및 검증

### 6.1 환경 변수 로드 확인

브라우저 콘솔에서:
```javascript
// 환경 변수 확인
console.log('[테스트] 클라이언트 ID:', window._env_?.REACT_APP_GOOGLE_CLIENT_ID);

// 예상 결과
// 858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com
```

### 6.2 파일 업로드 테스트

1. AS 디테일 페이지 또는 서비스 추가 페이지로 이동
2. 파일 업로드 버튼 클릭
3. 파일 선택
4. 콘솔에서 다음 로그 확인:
   ```
   [Env Load] 환경 변수 로드 완료
   [ServiceDetail] 구글 클라이언트 ID 확인
   [ServiceDetail] 인증 URL 생성
   ```
5. Google 인증 페이지로 리디렉트되는지 확인
6. 인증 완료 후 파일 업로드 성공 확인

### 6.3 인증 URL 확인

파일 업로드 시도 시 콘솔에 표시되는 인증 URL 확인:

**올바른 URL**:
```
https://accounts.google.com/oauth/authorize?client_id=858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fgoogle-auth-callback.html&scope=https://www.googleapis.com/auth/drive.file&response_type=token&access_type=offline
```

**잘못된 URL (이전 클라이언트 ID)**:
```
https://accounts.google.com/oauth/authorize?client_id=291524102200-u2ogome9r6r99klqh6foslt26nj5ndmg.apps.googleusercontent.com&...
```

---

## 7. 문제 해결 체크리스트

다음 항목을 순서대로 확인하세요:

- [ ] `public/env.js` 파일에 올바른 클라이언트 ID 설정됨
- [ ] `public/env.js` 파일에 오타 없음 (`REACT_APP_GOOGLE_DRIVE_SUBFOLDER`)
- [ ] `public/index.html`에서 `env.js` 파일 로드 확인
- [ ] Google Cloud Console에서 클라이언트 ID 확인
- [ ] Google Cloud Console에서 리디렉션 URI 확인
- [ ] 브라우저에서 저장된 토큰 삭제 완료
- [ ] 브라우저 캐시 클리어 완료
- [ ] 빌드 폴더 삭제 완료
- [ ] 개발 서버 재시작 완료
- [ ] 브라우저 콘솔에서 환경 변수 확인 완료
- [ ] 파일 업로드 테스트 완료

---

## 8. 자주 발생하는 문제

### 문제 1: 이전 클라이언트 ID가 계속 사용됨

**원인**: 브라우저 캐시 또는 빌드 폴더에 이전 값이 남아있음

**해결**:
1. 빌드 폴더 삭제: `rm -rf build`
2. 브라우저 캐시 클리어
3. 개발 서버 재시작
4. 시크릿 모드에서 테스트

### 문제 2: "redirect_uri_mismatch" 오류

**원인**: Google Cloud Console의 리디렉션 URI와 실제 사용하는 URI가 일치하지 않음

**해결**:
1. Google Cloud Console → **API 및 서비스** → **사용자 인증 정보**
2. OAuth 2.0 클라이언트 ID 클릭
3. **승인된 리디렉션 URI** 확인 및 수정
4. 정확한 URI만 입력 (쿼리 파라미터 없음)

### 문제 3: 환경 변수가 undefined

**원인**: `env.js` 파일이 로드되지 않음

**해결**:
1. `public/env.js` 파일 존재 확인
2. `public/index.html`에서 `env.js` 로드 확인
3. 네트워크 탭에서 `env.js` 파일이 404 에러인지 확인
4. 개발 서버 재시작

### 문제 4: 인증 후 원래 페이지로 돌아오지 않음

**원인**: `google-auth-callback.html`의 리디렉션 로직 문제

**해결**:
1. `public/google-auth-callback.html` 파일 확인
2. 리디렉션 로직 확인
3. `document.referrer` 사용 확인

---

## 9. 참고 자료

- [구글 클라이언트 ID 갱신 가이드](./GOOGLE_CLIENT_ID_UPDATE_GUIDE.md)
- [토큰 업데이트 가이드](./TOKEN_UPDATE_GUIDE.md)
- [환경 변수 문제 해결 가이드](./ENV_TROUBLESHOOTING.md)
- [Netlify 환경 변수 설정 가이드](./NETLIFY_ENV_VARIABLES.md)

---

## 10. 현재 설정값

**클라이언트 ID**:
```
858601328382-kpeaafkvvqaepgii0e79riruh8c642ei.apps.googleusercontent.com
```

**루트 폴더 ID**:
```
1bcCscOsNptDJvOVA1qSrbi-m6XU1y4d7
```

**서브폴더명**:
```
upload_crm
```

**리디렉션 URI**:
- 개발: `http://localhost:3000/google-auth-callback.html`
- 프로덕션: `https://crmapp8893.netlify.app/google-auth-callback.html`
