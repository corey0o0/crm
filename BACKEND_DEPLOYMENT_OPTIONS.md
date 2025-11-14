# 백엔드 서버 외부 배포 옵션

로컬이 아닌 외부에서 백엔드 서버를 실행하는 방법들을 정리했습니다.

## 배포 옵션

### 1. 클라우드 서버 (VPS)

#### AWS EC2, Google Cloud Compute Engine, Azure VM 등

**장점:**
- 완전한 제어 가능
- Playwright 설치 및 실행 가능
- 안정적이고 확장 가능

**단점:**
- 서버 관리 필요
- 비용이 발생할 수 있음
- 설정이 복잡할 수 있음

**설정 방법:**
```bash
# 서버에 Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 프로젝트 클론 및 설치
git clone <repository>
cd server
npm install
npx playwright install chromium

# PM2로 서버 실행 (백그라운드)
npm install -g pm2
pm2 start index.js --name "order-server"
pm2 save
pm2 startup
```

**환경 변수 설정:**
```bash
# .env 파일 생성
nano .env

# 내용
PORT=5000
ANTHROPIC_API_KEY=your_key
```

---

### 2. PaaS (Platform as a Service)

#### Heroku

**장점:**
- 간단한 배포
- 무료 티어 제공 (제한적)
- 자동 스케일링

**단점:**
- Playwright 설치가 복잡할 수 있음
- 무료 티어는 제한적
- 30분 비활성 시 슬립 모드

**설정 방법:**

1. `Procfile` 생성:
```
web: node index.js
```

2. `package.json`에 스크립트 추가:
```json
{
  "scripts": {
    "start": "node index.js",
    "postinstall": "npx playwright install chromium"
  }
}
```

3. Heroku 배포:
```bash
heroku create your-app-name
git push heroku main
```

---

#### Railway

**장점:**
- 간단한 배포
- Playwright 지원
- 무료 크레딧 제공

**단점:**
- 무료 크레딧 소진 시 비용 발생

**설정 방법:**

1. Railway에 프로젝트 연결
2. 환경 변수 설정
3. 자동 배포

---

#### Render

**장점:**
- 무료 티어 제공
- 간단한 배포
- 자동 HTTPS

**단점:**
- 무료 티어는 제한적
- Playwright 설치 확인 필요

**설정 방법:**

1. Render에 프로젝트 연결
2. 빌드 명령: `npm install && npx playwright install chromium`
3. 시작 명령: `node index.js`

---

### 3. Docker 컨테이너

**장점:**
- 환경 독립성
- 어디서든 실행 가능
- 확장 가능

**단점:**
- Docker 설정 필요
- 이미지 크기가 클 수 있음

**설정 방법:**

1. `Dockerfile` 생성:
```dockerfile
FROM node:18

# Playwright 의존성 설치
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# Playwright 브라우저 설치
RUN npx playwright install chromium

COPY . .

EXPOSE 5000

CMD ["node", "index.js"]
```

2. Docker 이미지 빌드:
```bash
docker build -t order-server .
```

3. Docker 컨테이너 실행:
```bash
docker run -p 5000:5000 --env-file .env order-server
```

4. Docker Hub에 푸시:
```bash
docker tag order-server your-username/order-server
docker push your-username/order-server
```

---

### 4. Supabase Edge Functions

**장점:**
- Supabase와 통합
- 서버리스
- 자동 스케일링

**단점:**
- Playwright 실행 제한적 (Deno 환경)
- 설정이 복잡할 수 있음

**설정 방법:**

1. Supabase CLI 설치
2. Edge Function 생성
3. Playwright 대신 다른 방법 고려 (예: Puppeteer)

---

### 5. Serverless Functions

#### AWS Lambda, Vercel Functions, Netlify Functions

**장점:**
- 서버리스
- 자동 스케일링
- 비용 효율적

**단점:**
- Playwright 실행 제한적 (실행 시간 제한)
- 콜드 스타트 문제
- 메모리 제한

**설정 방법:**

Playwright는 Lambda에서 실행하기 어려우므로, 다른 방법을 고려해야 합니다.

---

## 추천 사항

### 현재 상황에 가장 적합한 옵션

1. **Railway** ⭐ 추천
   - Playwright 지원
   - 간단한 배포
   - 무료 크레딧 제공

2. **Render**
   - 무료 티어 제공
   - 간단한 배포
   - Playwright 설치 가능

3. **VPS (AWS EC2, DigitalOcean 등)**
   - 완전한 제어
   - Playwright 실행 가능
   - 안정적

4. **Docker + 클라우드 서버**
   - 환경 독립성
   - 확장 가능
   - 어디서든 실행 가능

---

## 배포 후 설정

### 1. 환경 변수 설정

배포 플랫폼에서 환경 변수를 설정해야 합니다:

```
PORT=5000
ANTHROPIC_API_KEY=your_key
```

### 2. 프론트엔드 API URL 변경

프론트엔드에서 배포된 백엔드 서버 URL을 사용하도록 설정:

```javascript
// .env 파일
REACT_APP_API_URL=https://your-backend-server.com
```

또는:

```javascript
// src/utils/orderAutomation.js
const apiUrl = process.env.REACT_APP_API_URL || 'https://your-backend-server.com';
```

### 3. CORS 설정 확인

백엔드 서버의 CORS 설정이 프론트엔드 도메인을 허용하는지 확인:

```javascript
// server/index.js
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
  credentials: true
}));
```

---

## 각 옵션별 상세 가이드

각 배포 옵션에 대한 상세한 설정 가이드는 별도 파일로 제공할 수 있습니다.

