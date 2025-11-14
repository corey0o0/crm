# AWS 비용 분석 및 무료 옵션

## AWS 비용 구조

### EC2 (가상 서버)

#### 무료 티어 (Free Tier)

**AWS 신규 계정 12개월 무료:**
- **t2.micro** 또는 **t3.micro** 인스턴스
- **750시간/월** (한 달 내내 실행 가능)
- **리전당** 1개 인스턴스
- **Linux/Windows** 선택 가능

**무료 티어 제한:**
- 인스턴스 타입: t2.micro, t3.micro만 가능
- 메모리: 1GB (t2.micro), 2GB (t3.micro)
- CPU: 1 vCPU (버스트 가능)
- 스토리지: 30GB EBS (무료)

**주의사항:**
- 12개월 후에는 유료로 전환
- 무료 티어를 초과하면 비용 발생
- 데이터 전송량 제한 (1GB/월 무료)

#### 유료 가격 (무료 티어 종료 후)

**t2.micro (1GB RAM, 1 vCPU):**
- **약 $8-10/월** (리전에 따라 다름)
- 시간당 약 $0.0116

**t3.micro (2GB RAM, 2 vCPU):**
- **약 $7-9/월** (리전에 따라 다름)
- 시간당 약 $0.0104

**추가 비용:**
- EBS 스토리지: $0.10/GB/월 (30GB 초과 시)
- 데이터 전송: 1GB/월 무료, 이후 $0.09/GB
- Elastic IP: 인스턴스 실행 중이면 무료

---

### Lambda (서버리스)

**무료 티어:**
- **100만 요청/월** 무료
- **400,000 GB-초 컴퓨팅 시간/월** 무료

**주의사항:**
- Playwright 실행에는 제한적 (실행 시간 제한, 메모리 제한)
- 콜드 스타트 문제

---

### Lightsail (간단한 VPS)

**가격:**
- **$3.50/월**: 512MB RAM, 1 vCPU, 20GB SSD
- **$5/월**: 1GB RAM, 1 vCPU, 40GB SSD
- **$10/월**: 2GB RAM, 1 vCPU, 60GB SSD

**무료 티어:**
- 없음 (하지만 가장 저렴한 옵션)

---

## 무료로 이용할 수 있는 방법

### 1. AWS 무료 티어 (12개월) ⭐

**조건:**
- AWS 신규 계정
- 12개월 동안 무료
- t2.micro 또는 t3.micro 인스턴스만 가능

**설정:**
```bash
# EC2 인스턴스 생성
# 인스턴스 타입: t2.micro (무료 티어)
# OS: Ubuntu 22.04 LTS
# 스토리지: 30GB (무료 티어)
```

**비용:**
- **12개월 동안 무료**
- 12개월 후: 약 $8-10/월

---

### 2. Oracle Cloud Always Free ⭐⭐⭐ (가장 추천)

**무료 제공:**
- **2개의 VM 인스턴스** (영구 무료)
- **각 1GB RAM, 1 vCPU**
- **200GB 스토리지**
- **10TB 데이터 전송/월**

**조건:**
- Oracle Cloud 계정 생성
- 신용카드 등록 필요 (비용 청구 안 됨)

**비용:**
- **완전 무료** (영구 무료 티어)

**설정:**
```bash
# Oracle Cloud에서 VM 인스턴스 생성
# Shape: VM.Standard.E2.1.Micro (Always Free)
# OS: Ubuntu 22.04
```

---

### 3. Google Cloud Platform (GCP) 무료 티어

**무료 제공:**
- **$300 크레딧** (90일간)
- **f1-micro 인스턴스** (무료, 제한적)

**비용:**
- 90일 동안 $300 크레딧 사용 가능
- 이후: 약 $6-8/월

---

### 4. Azure 무료 티어

**무료 제공:**
- **$200 크레딧** (30일간)
- **B1S 인스턴스** (12개월 무료)

**비용:**
- 30일 동안 $200 크레딧 사용 가능
- 이후: 약 $10-15/월

---

### 5. Railway (무료 크레딧)

**무료 제공:**
- **$5 크레딧/월** (영구 무료)
- Playwright 지원

**비용:**
- **$5/월 크레딧 무료** (사용량이 적으면 무료)
- 초과 시: 사용한 만큼만 비용

---

### 6. Render (무료 티어)

**무료 제공:**
- **무료 티어** (제한적)
- 15분 비활성 시 슬립 모드

**비용:**
- **무료** (제한적)
- 유료: $7/월

---

### 7. Fly.io (무료 티어)

**무료 제공:**
- **3개의 공유 CPU VM** (무료)
- **3GB 스토리지** (무료)
- **160GB 데이터 전송/월** (무료)

**비용:**
- **무료** (제한적)
- 초과 시: 사용한 만큼만 비용

---

## 비용 비교표

| 플랫폼 | 무료 티어 | 유료 시작 가격 | Playwright 지원 | 추천도 |
|--------|----------|---------------|----------------|--------|
| **Oracle Cloud** | 영구 무료 | - | ✅ | ⭐⭐⭐ |
| **Railway** | $5/월 크레딧 | $5/월 | ✅ | ⭐⭐⭐ |
| **AWS EC2** | 12개월 무료 | $8-10/월 | ✅ | ⭐⭐ |
| **Render** | 제한적 무료 | $7/월 | ✅ | ⭐⭐ |
| **Fly.io** | 제한적 무료 | 사용량 기반 | ✅ | ⭐⭐ |
| **GCP** | $300 크레딧 | $6-8/월 | ✅ | ⭐ |
| **Azure** | $200 크레딧 | $10-15/월 | ✅ | ⭐ |
| **Heroku** | 제한적 무료 | $7/월 | ⚠️ | ⭐ |

---

## 추천 순서

### 1. Oracle Cloud Always Free ⭐⭐⭐ (가장 추천)

**이유:**
- **완전 무료** (영구 무료 티어)
- **2개의 VM 인스턴스** 제공
- **충분한 리소스** (1GB RAM, 1 vCPU)
- **Playwright 실행 가능**

**단점:**
- 신용카드 등록 필요 (비용 청구 안 됨)
- 설정이 약간 복잡할 수 있음

---

### 2. Railway ⭐⭐⭐

**이유:**
- **$5/월 크레딧 무료** (사용량이 적으면 무료)
- **Playwright 지원**
- **간단한 배포**
- **자동 HTTPS**

**단점:**
- 사용량이 많으면 비용 발생

---

### 3. AWS EC2 무료 티어 ⭐⭐

**이유:**
- **12개월 무료**
- **안정적**
- **Playwright 실행 가능**

**단점:**
- 12개월 후 유료 전환
- 무료 티어 제한 (1GB RAM)

---

## Oracle Cloud Always Free 설정 가이드

### 1. Oracle Cloud 계정 생성

1. Oracle Cloud 웹사이트 접속: https://www.oracle.com/cloud/free/
2. "Start for Free" 클릭
3. 계정 생성 (신용카드 등록 필요, 비용 청구 안 됨)

### 2. VM 인스턴스 생성

1. Oracle Cloud Console 접속
2. "Compute" → "Instances" 선택
3. "Create Instance" 클릭
4. 설정:
   - **Name**: order-server
   - **Image**: Ubuntu 22.04
   - **Shape**: VM.Standard.E2.1.Micro (Always Free)
   - **Networking**: Public IP 자동 할당
   - **SSH Keys**: 새 키 생성 또는 기존 키 사용

### 3. 인스턴스 접속 및 설정

```bash
# SSH 접속
ssh ubuntu@<public-ip>

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 프로젝트 클론
git clone <repository>
cd server
npm install
npx playwright install chromium

# PM2로 서버 실행
npm install -g pm2
pm2 start index.js --name "order-server"
pm2 save
pm2 startup
```

### 4. 환경 변수 설정

```bash
# .env 파일 생성
nano .env

# 내용
PORT=5000
ANTHROPIC_API_KEY=your_key
```

### 5. 방화벽 설정

Oracle Cloud Console에서:
1. "Networking" → "Security Lists" 선택
2. 인바운드 규칙 추가:
   - **Source**: 0.0.0.0/0
   - **IP Protocol**: TCP
   - **Destination Port Range**: 5000

### 6. 프론트엔드 설정

```javascript
// .env
REACT_APP_API_URL=http://<public-ip>:5000
// 또는 도메인 연결 후
REACT_APP_API_URL=https://your-domain.com
```

---

## AWS EC2 무료 티어 설정 가이드

### 1. AWS 계정 생성

1. AWS 웹사이트 접속: https://aws.amazon.com
2. "Create an AWS Account" 클릭
3. 계정 생성 (신용카드 등록 필요)

### 2. EC2 인스턴스 생성

1. AWS Console 접속
2. "EC2" 서비스 선택
3. "Launch Instance" 클릭
4. 설정:
   - **Name**: order-server
   - **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance type**: t2.micro (Free tier eligible)
   - **Key pair**: 새 키 생성 또는 기존 키 사용
   - **Network settings**: 보안 그룹에서 포트 5000 열기

### 3. 인스턴스 접속 및 설정

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@<public-ip>

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 프로젝트 클론
git clone <repository>
cd server
npm install
npx playwright install chromium

# PM2로 서버 실행
npm install -g pm2
pm2 start index.js --name "order-server"
pm2 save
pm2 startup
```

### 4. 보안 그룹 설정

AWS Console에서:
1. "EC2" → "Security Groups" 선택
2. 보안 그룹 선택
3. "Inbound rules" → "Edit inbound rules"
4. 규칙 추가:
   - **Type**: Custom TCP
   - **Port**: 5000
   - **Source**: 0.0.0.0/0

---

## 비용 절감 팁

### 1. 무료 티어 최대한 활용

- Oracle Cloud Always Free 사용 (영구 무료)
- AWS 무료 티어 12개월 활용
- Railway $5/월 크레딧 활용

### 2. 사용량 모니터링

- AWS Cost Explorer로 비용 모니터링
- 무료 티어 제한 초과 방지
- 불필요한 리소스 삭제

### 3. 인스턴스 최적화

- 필요한 만큼만 리소스 사용
- 사용하지 않을 때 인스턴스 중지 (AWS)
- 자동 스케일링 설정

---

## 결론

### 가장 추천하는 옵션

1. **Oracle Cloud Always Free** ⭐⭐⭐
   - **완전 무료** (영구 무료 티어)
   - **충분한 리소스**
   - **Playwright 실행 가능**

2. **Railway** ⭐⭐⭐
   - **$5/월 크레딧 무료**
   - **간단한 배포**
   - **Playwright 지원**

3. **AWS EC2 무료 티어** ⭐⭐
   - **12개월 무료**
   - **안정적**
   - **Playwright 실행 가능**

---

## 다음 단계

1. Oracle Cloud 또는 Railway 계정 생성
2. 서버 배포
3. 환경 변수 설정
4. 프론트엔드 API URL 변경
5. 테스트

