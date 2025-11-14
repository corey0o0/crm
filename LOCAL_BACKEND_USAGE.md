# 로컬 백엔드 서버 사용 가이드

## 개요

Playwright를 사용한 주문 자동화 기능을 로컬에서만 실행하는 방법입니다. 클라우드 서버 없이 필요할 때만 로컬에서 백엔드 서버를 실행하여 처리합니다.

## 장점

✅ **비용 없음** - 클라우드 서버 비용이 발생하지 않습니다  
✅ **완전한 제어** - 로컬 환경에서 완전히 제어 가능  
✅ **보안** - 데이터가 로컬에서만 처리됩니다  
✅ **간단한 설정** - 복잡한 배포 과정이 필요 없습니다  

## 단점

⚠️ **로컬 컴퓨터 필요** - 주문 처리 시 로컬 컴퓨터가 켜져 있어야 합니다  
⚠️ **외부 접근 불가** - 로컬 네트워크에서만 접근 가능합니다  
⚠️ **수동 실행** - 필요할 때마다 서버를 직접 실행해야 합니다  

---

## 사용 방법

### 1단계: 백엔드 서버 실행

#### 방법 1: npm start 사용

```bash
# 터미널에서 server 디렉토리로 이동
cd server

# 서버 실행
npm start
```

#### 방법 2: 개발 모드 (자동 재시작)

```bash
# nodemon이 설치되어 있는 경우
npm run dev
```

#### 방법 3: 직접 실행

```bash
node index.js
```

### 2단계: 서버 실행 확인

브라우저에서 다음 URL을 열어 서버가 정상적으로 실행 중인지 확인:

```
http://localhost:5000/api/health
```

정상적으로 실행 중이면 다음 응답이 표시됩니다:

```json
{
  "status": "ok",
  "message": "서버가 정상적으로 실행 중입니다."
}
```

### 3단계: 프론트엔드에서 사용

프론트엔드가 이미 `http://localhost:5000`을 기본값으로 사용하도록 설정되어 있으므로, 별도 설정 없이 바로 사용할 수 있습니다.

---

## 환경 변수 설정

### 백엔드 서버 (.env 파일)

`server/.env` 파일을 생성하고 다음 내용을 추가:

```env
PORT=5000
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLOUDMERSIVE_API_KEY=your_cloudmersive_api_key_here
```

### 프론트엔드 (.env 파일)

프론트엔드 프로젝트 루트의 `.env` 파일에 다음을 추가 (선택사항):

```env
REACT_APP_API_URL=http://localhost:5000
```

**참고:** 이미 기본값으로 `http://localhost:5000`이 설정되어 있으므로 생략 가능합니다.

---

## Playwright 브라우저 설치

처음 실행 시 Playwright 브라우저를 설치해야 합니다:

```bash
cd server
npx playwright install chromium
npx playwright install-deps chromium
```

---

## 사용 시나리오

### 시나리오 1: 주문 대기 페이지에서 주문 처리

1. **백엔드 서버 실행**
   ```bash
   cd server
   npm start
   ```

2. **프론트엔드 실행** (별도 터미널)
   ```bash
   npm start
   ```

3. **주문 대기 페이지 접속**
   - 브라우저에서 `http://localhost:3000/pending-orders` 접속

4. **주문 처리**
   - 주문 대기 항목 선택
   - "주문 처리" 버튼 클릭
   - 백엔드 서버가 자동으로 브라우저를 실행하여 주문 처리

5. **완료 후 서버 종료** (선택사항)
   - `Ctrl + C`로 서버 종료

### 시나리오 2: 상품 검색

1. **백엔드 서버 실행**
   ```bash
   cd server
   npm start
   ```

2. **주문 대기 상세 페이지에서 상품 검색**
   - 상품 매칭 다이얼로그에서 "웹사이트에서 검색" 클릭
   - 백엔드 서버가 자동으로 브라우저를 실행하여 상품 검색

---

## 프론트엔드에서 서버 상태 확인

프론트엔드에서 백엔드 서버가 실행 중인지 확인하는 기능을 추가할 수 있습니다:

```javascript
// src/utils/orderAutomation.js에 추가
export const checkBackendServer = async () => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/api/health`);
    if (response.ok) {
      return { success: true, message: '서버가 실행 중입니다.' };
    } else {
      return { success: false, message: '서버가 응답하지 않습니다.' };
    }
  } catch (error) {
    return { 
      success: false, 
      message: '서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.' 
    };
  }
};
```

---

## 문제 해결

### 문제 1: "서버에 연결할 수 없습니다" 오류

**원인:** 백엔드 서버가 실행되지 않았습니다.

**해결:**
1. 터미널에서 `cd server` 실행
2. `npm start` 실행
3. 서버가 정상적으로 시작되었는지 확인

### 문제 2: CORS 오류

**원인:** CORS 설정 문제

**해결:**
- `server/index.js`의 CORS 설정이 `http://localhost:3000`을 허용하는지 확인
- 이미 설정되어 있으므로 문제 없어야 합니다

### 문제 3: Playwright 브라우저 오류

**원인:** Playwright 브라우저가 설치되지 않았습니다.

**해결:**
```bash
cd server
npx playwright install chromium
npx playwright install-deps chromium
```

### 문제 4: 포트 5000이 이미 사용 중

**원인:** 다른 프로세스가 포트 5000을 사용하고 있습니다.

**해결:**
1. 포트를 사용하는 프로세스 확인:
   ```bash
   lsof -i :5000
   ```

2. 프로세스 종료:
   ```bash
   kill -9 <PID>
   ```

3. 또는 다른 포트 사용:
   ```bash
   # server/.env 파일에서
   PORT=5001
   ```

---

## 자동화 스크립트 (선택사항)

### 백엔드 서버 자동 실행 스크립트

#### macOS/Linux

`server/start.sh` 파일 생성:

```bash
#!/bin/bash
cd "$(dirname "$0")"
echo "백엔드 서버를 시작합니다..."
npm start
```

실행 권한 부여:
```bash
chmod +x server/start.sh
```

실행:
```bash
./server/start.sh
```

#### Windows

`server/start.bat` 파일 생성:

```batch
@echo off
cd /d %~dp0
echo 백엔드 서버를 시작합니다...
npm start
```

실행:
```bash
start.bat
```

---

## 프론트엔드와 백엔드 동시 실행

### 방법 1: 두 개의 터미널 사용

**터미널 1 (백엔드):**
```bash
cd server
npm start
```

**터미널 2 (프론트엔드):**
```bash
npm start
```

### 방법 2: concurrently 사용

프로젝트 루트에 `concurrently` 설치:

```bash
npm install --save-dev concurrently
```

`package.json`에 스크립트 추가:

```json
{
  "scripts": {
    "dev": "concurrently \"npm start\" \"cd server && npm start\"",
    "dev:frontend": "npm start",
    "dev:backend": "cd server && npm start"
  }
}
```

실행:
```bash
npm run dev
```

---

## 주의사항

1. **서버 실행 필수**: 주문 처리나 상품 검색 기능을 사용하려면 반드시 백엔드 서버가 실행 중이어야 합니다.

2. **브라우저 자동 실행**: Playwright가 브라우저를 자동으로 실행합니다. 백그라운드에서 실행되므로 화면에 보이지 않을 수 있습니다.

3. **리소스 사용**: Playwright는 브라우저를 실행하므로 메모리와 CPU를 사용합니다. 주문 처리 중에는 다른 작업을 하지 않는 것이 좋습니다.

4. **보안**: 로컬에서만 실행되므로 보안상 안전하지만, API 키는 `.env` 파일에 안전하게 보관하세요.

---

## 다음 단계

1. ✅ 백엔드 서버 실행 방법 확인
2. ✅ 프론트엔드에서 주문 처리 테스트
3. ✅ 상품 검색 기능 테스트
4. ✅ 오류 발생 시 문제 해결 가이드 참고

---

## 참고 자료

- Playwright 문서: https://playwright.dev/
- Express.js 문서: https://expressjs.com/
- Node.js 문서: https://nodejs.org/

