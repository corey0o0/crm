# 구글 드라이브 토큰 업데이트 가이드

## 토큰 업데이트가 필요한 경우

1. 새로운 클라이언트 ID로 변경한 경우
2. 토큰이 만료된 경우
3. 인증 오류가 발생하는 경우
4. 다른 구글 계정으로 변경하고 싶은 경우

## 방법 1: 브라우저 콘솔에서 토큰 삭제 후 재인증 (가장 간단)

### 단계별 가이드

1. **브라우저 개발자 도구 열기**
   - Windows/Linux: `F12` 또는 `Ctrl + Shift + I`
   - Mac: `Cmd + Option + I`

2. **Console 탭 선택**

3. **다음 명령어 실행하여 토큰 삭제:**
   ```javascript
   localStorage.removeItem('google_access_token');
   console.log('✅ 토큰이 삭제되었습니다.');
   ```

4. **토큰 삭제 확인:**
   ```javascript
   console.log('현재 토큰:', localStorage.getItem('google_access_token'));
   // null이 출력되면 삭제 완료
   ```

5. **페이지 새로고침**
   - `F5` 또는 `Cmd + R`

6. **파일 업로드 시도**
   - 파일 업로드 버튼 클릭
   - 자동으로 구글 인증 페이지로 이동
   - 새로 인증 완료

## 방법 2: Application 탭에서 삭제

1. **브라우저 개발자 도구 열기** (`F12`)

2. **Application 탭 선택** (Chrome) 또는 **Storage 탭** (Firefox)

3. **왼쪽 사이드바에서:**
   - `Local Storage` > `http://localhost:3000` (개발 환경)
   - 또는 `https://crmapp8893.netlify.app` (프로덕션 환경)

4. **`google_access_token` 키 찾기**

5. **우클릭 > Delete** 또는 키 선택 후 `Delete` 키 누르기

6. **페이지 새로고침**

7. **파일 업로드 시도하여 재인증**

## 방법 3: 코드에서 토큰 강제 삭제 함수 추가 (개발자용)

개발자 도구 콘솔에서 사용할 수 있는 헬퍼 함수:

```javascript
// 토큰 삭제 및 페이지 새로고침
function resetGoogleToken() {
  localStorage.removeItem('google_access_token');
  console.log('✅ 구글 드라이브 토큰이 삭제되었습니다.');
  console.log('페이지를 새로고침하면 재인증이 필요합니다.');
  location.reload();
}

// 사용법
resetGoogleToken();
```

## 방법 4: 토큰 상태 확인

현재 토큰이 있는지, 유효한지 확인:

```javascript
// 토큰 존재 여부 확인
const token = localStorage.getItem('google_access_token');
if (token) {
  console.log('토큰 존재:', token.substring(0, 20) + '...');
  
  // 토큰 유효성 검사
  fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(response => {
    if (response.ok) {
      console.log('✅ 토큰이 유효합니다.');
    } else {
      console.log('❌ 토큰이 만료되었거나 유효하지 않습니다.');
      console.log('토큰을 삭제하고 재인증하세요.');
    }
  });
} else {
  console.log('토큰이 없습니다. 파일 업로드를 시도하면 인증 페이지로 이동합니다.');
}
```

## 방법 5: 모든 localStorage 데이터 삭제 (주의!)

모든 로컬 저장 데이터를 삭제하려면:

```javascript
localStorage.clear();
console.log('✅ 모든 localStorage 데이터가 삭제되었습니다.');
location.reload();
```

⚠️ **주의**: 이 방법은 다른 중요한 데이터도 함께 삭제됩니다.

## 자동 토큰 갱신 (코드 개선)

코드가 이미 개선되어 있어서:
- 토큰이 만료되면 자동으로 삭제
- 파일 업로드 시도 시 자동으로 재인증 페이지로 이동
- 인증 완료 후 자동으로 새 토큰 저장

## 문제 해결

### 토큰을 삭제했는데도 여전히 오류가 발생하는 경우

1. **브라우저 캐시 삭제**
   - `Ctrl + Shift + Delete` (Windows/Linux)
   - `Cmd + Shift + Delete` (Mac)

2. **시크릿/프라이빗 모드에서 테스트**
   - 새로운 브라우저 창에서 테스트

3. **구글 클라이언트 ID 확인**
   - `public/env.js` 파일에서 `REACT_APP_GOOGLE_CLIENT_ID` 확인
   - 새로운 클라이언트 ID가 올바르게 설정되어 있는지 확인

4. **구글 클라우드 콘솔 확인**
   - 승인된 리디렉션 URI가 올바르게 설정되어 있는지 확인
   - `http://localhost:3000/google-auth-callback.html`
   - `https://crmapp8893.netlify.app/google-auth-callback.html`

## 빠른 참조

```javascript
// 토큰 삭제
localStorage.removeItem('google_access_token');

// 토큰 확인
localStorage.getItem('google_access_token');

// 모든 데이터 삭제
localStorage.clear();
```

