# 구글 드라이브 토큰 재설정 가이드

## 문제 상황
이전 클라이언트 ID로 발급받은 토큰이 localStorage에 남아있어서 새로운 클라이언트 ID로 인증이 실패할 수 있습니다.

## 해결 방법

### 방법 1: 브라우저 콘솔에서 토큰 삭제 (권장)

1. 브라우저 개발자 도구 열기 (F12 또는 Cmd+Option+I)
2. Console 탭 선택
3. 다음 명령어 실행:

```javascript
localStorage.removeItem('google_access_token');
console.log('토큰이 삭제되었습니다. 페이지를 새로고침하세요.');
```

4. 페이지 새로고침 (F5 또는 Cmd+R)
5. 파일 업로드를 다시 시도하면 인증 페이지로 이동합니다.

### 방법 2: Application 탭에서 삭제

1. 브라우저 개발자 도구 열기 (F12 또는 Cmd+Option+I)
2. Application 탭 선택 (Chrome) 또는 Storage 탭 (Firefox)
3. 왼쪽 사이드바에서 "Local Storage" > "http://localhost:3000" 선택
4. `google_access_token` 키를 찾아서 삭제
5. 페이지 새로고침

### 방법 3: 자동 삭제 (코드 개선됨)

코드가 이미 개선되어 토큰 유효성 검사 실패 시 자동으로 삭제됩니다. 
하지만 이전 토큰이 남아있다면 위의 방법 1 또는 2를 사용하세요.

## 확인 방법

토큰이 삭제되었는지 확인:

```javascript
console.log(localStorage.getItem('google_access_token'));
// null이 출력되면 삭제 완료
```

## 새로 인증하기

1. 토큰 삭제 후 페이지 새로고침
2. 파일 업로드 버튼 클릭
3. 구글 인증 페이지로 자동 이동
4. 인증 완료 후 파일 업로드 재시도

