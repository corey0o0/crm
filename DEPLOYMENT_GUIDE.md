# 백엔드 서버 배포 가이드

## 개요

백엔드 서버를 외부에서 실행하는 방법들을 정리했습니다.

## 배포 옵션

### 1. Railway (추천) ⭐

**장점:**
- Playwright 지원
- 간단한 배포
- 무료 크레딧 제공 ($5/월)
- 자동 HTTPS

**배포 방법:**

1. Railway 계정 생성: https://railway.app
2. 새 프로젝트 생성
3. GitHub 저장소 연결
4. 환경 변수 설정:
   - `PORT` (자동 설정됨)
   - `ANTHROPIC_API_KEY`
5. 배포 완료

**프론트엔드 설정:**
```javascript
// .env
REACT_APP_API_URL=https://your-app.railway.app
```

---

### 2. Render

**장점:**
- 무료 티어 제공
- 간단한 배포
- 자동 HTTPS

**배포 방법:**

1. Render 계정 생성: https://render.com
2. 새 Web Service 생성
3. GitHub 저장소 연결
4. 설정:
   - **Build Command**: `npm install && npx playwright install chromium`
   - **Start Command**: `node index.js`
5. 환경 변수 설정
6. 배포 완료

**프론트엔드 설정:**
```javascript
// .env
REACT_APP_API_URL=https://your-app.onrender.com
```

---

### 3. Heroku

**장점:**
- 간단한 배포
- 무료 티어 (제한적)

**배포 방법:**

1. Heroku CLI 설치
2. Heroku 계정 생성
3. Heroku 앱 생성:
```bash
heroku create your-app-name
```

4. 환경 변수 설정:
```bash
heroku config:set ANTHROPIC_API_KEY=your_key
```

5. 배포:
```bash
git push heroku main
```

**주의사항:**
- Heroku는 30분 비활성 시 슬립 모드로 전환됩니다.
- Playwright 설치를 위해 `package.json`에 `postinstall` 스크립트가 필요합니다.

**프론트엔드 설정:**
```javascript
// .env
REACT_APP_API_URL=https://your-app.herokuapp.com
```

---

### 4. Docker + 클라우드 서버

**장점:**
- 환경 독립성
- 어디서든 실행 가능
- 완전한 제어

**배포 방법:**

#### Docker 이미지 빌드

```bash
cd server
docker build -t order-server .
```

#### Docker Hub에 푸시

```bash
docker tag order-server your-username/order-server
docker login
docker push your-username/order-server
```

#### 클라우드 서버에서 실행

```bash
# 서버에 Docker 설치
# Docker 이미지 풀
docker pull your-username/order-server

# 컨테이너 실행
docker run -d \
  -p 5000:5000 \
  --name order-server \
  --env-file .env \
  your-username/order-server
```

#### 클라우드 서버 옵션

- **AWS EC2**: https://aws.amazon.com/ec2
- **Google Cloud Compute Engine**: https://cloud.google.com/compute
- **DigitalOcean**: https://www.digitalocean.com
- **Linode**: https://www.linode.com

---

### 5. VPS (Virtual Private Server)

**장점:**
- 완전한 제어
- Playwright 실행 가능
- 안정적

**배포 방법:**

1. VPS 서버 생성 (Ubuntu 20.04+)
2. SSH 접속
3. Node.js 설치:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. 프로젝트 클론:
```bash
git clone <repository>
cd server
npm install
npx playwright install chromium
```

5. PM2로 서버 실행:
```bash
npm install -g pm2
pm2 start index.js --name "order-server"
pm2 save
pm2 startup
```

6. Nginx 리버스 프록시 설정 (선택사항):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

7. SSL 인증서 설정 (Let's Encrypt):
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**프론트엔드 설정:**
```javascript
// .env
REACT_APP_API_URL=https://your-domain.com
```

---

## 배포 후 설정

### 1. 환경 변수 설정

배포 플랫폼에서 환경 변수를 설정해야 합니다:

- `PORT` (일부 플랫폼은 자동 설정)
- `ANTHROPIC_API_KEY`
- `CLOUDMERSIVE_API_KEY` (필요한 경우)

### 2. CORS 설정

백엔드 서버의 CORS 설정이 프론트엔드 도메인을 허용하는지 확인:

```javascript
// server/index.js
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://your-frontend-domain.com'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // origin이 없거나 허용된 origin 목록에 있으면 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS 정책에 의해 차단되었습니다'));
    }
  },
  credentials: true
}));
```

### 3. 프론트엔드 API URL 변경

프론트엔드에서 배포된 백엔드 서버 URL을 사용하도록 설정:

```javascript
// .env 파일
REACT_APP_API_URL=https://your-backend-server.com
```

또는 환경별 설정:

```javascript
// .env.production
REACT_APP_API_URL=https://your-backend-server.com

// .env.development
REACT_APP_API_URL=http://localhost:5000
```

---

## 추천 배포 순서

1. **Oracle Cloud Always Free** ⭐⭐⭐ (가장 추천)
   - **영구 무료** (완전 무료)
   - Playwright 실행 가능
   - 충분한 리소스 (1GB RAM, 1 vCPU)
   - 상세 가이드: `ORACLE_CLOUD_SETUP.md` 참고

2. **Railway** ⭐⭐⭐
   - $5/월 크레딧 무료
   - Playwright 지원
   - 간단한 배포

3. **Render** (무료 티어)
   - 무료 티어 제공
   - 간단한 배포
   - Playwright 설치 가능

4. **VPS** (완전한 제어)
   - 완전한 제어
   - Playwright 실행 가능
   - 안정적

5. **Docker + 클라우드 서버** (확장성)
   - 환경 독립성
   - 확장 가능
   - 어디서든 실행 가능

---

## 문제 해결

### Playwright 설치 오류

배포 플랫폼에서 Playwright 브라우저 설치가 실패하는 경우:

1. 빌드 명령에 Playwright 설치 추가:
```bash
npm install && npx playwright install chromium
```

2. `package.json`에 `postinstall` 스크립트 추가:
```json
{
  "scripts": {
    "postinstall": "npx playwright install chromium || true"
  }
}
```

### CORS 오류

프론트엔드에서 백엔드 API 호출 시 CORS 오류가 발생하는 경우:

1. 백엔드 서버의 CORS 설정 확인
2. 프론트엔드 도메인이 허용 목록에 있는지 확인
3. 환경 변수 `FRONTEND_URL` 설정

### 연결 오류

프론트엔드에서 백엔드 서버에 연결할 수 없는 경우:

1. 백엔드 서버가 실행 중인지 확인
2. 포트가 올바르게 노출되어 있는지 확인
3. 방화벽 설정 확인
4. `REACT_APP_API_URL` 환경 변수가 올바른지 확인

---

## 비용 비교

| 플랫폼 | 무료 티어 | 유료 시작 가격 | Playwright 지원 | 추천도 |
|--------|----------|---------------|----------------|--------|
| **Oracle Cloud** | 영구 무료 | - | ✅ | ⭐⭐⭐ |
| **Railway** | $5/월 크레딧 | $5/월 | ✅ | ⭐⭐⭐ |
| **AWS EC2** | 12개월 무료 | $8-10/월 | ✅ | ⭐⭐ |
| **Render** | 제한적 무료 | $7/월 | ✅ | ⭐⭐ |
| **Fly.io** | 제한적 무료 | 사용량 기반 | ✅ | ⭐⭐ |
| **Heroku** | 제한적 | $7/월 | ⚠️ | ⭐ |
| **VPS** | 없음 | $5-10/월 | ✅ | ⭐⭐ |
| **GCP** | $300 크레딧 | $6-8/월 | ✅ | ⭐ |
| **Azure** | $200 크레딧 | $10-15/월 | ✅ | ⭐ |

### 무료 옵션 상세

#### 1. Oracle Cloud Always Free ⭐⭐⭐ (가장 추천)
- **영구 무료**: 2개의 VM 인스턴스 (각 1GB RAM, 1 vCPU)
- **200GB 스토리지** 무료
- **10TB 데이터 전송/월** 무료
- **비용**: 완전 무료 (영구)

#### 2. Railway
- **$5/월 크레딧** 무료 (사용량이 적으면 무료)
- **비용**: 사용량 기반** (초과 시에만 비용)

#### 3. AWS EC2 무료 티어
- **12개월 무료**: t2.micro 인스턴스 (1GB RAM, 1 vCPU)
- **750시간/월** 무료
- **30GB EBS 스토리지** 무료
- **비용**: 12개월 후 약 $8-10/월

---

## 다음 단계

1. 배포 플랫폼 선택
2. 배포 진행
3. 환경 변수 설정
4. 프론트엔드 API URL 변경
5. 테스트

