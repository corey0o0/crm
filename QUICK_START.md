# 빠른 시작 가이드

이 문서는 프로젝트를 빠르게 이해하고 시작하기 위한 요약 가이드입니다.

---

## 🚀 프로젝트 개요

**CRM 애플리케이션** - A/S 서비스 관리, 재고 관리, 주문 관리 등을 제공하는 React 기반 웹 애플리케이션

**주요 기술:**
- React 18 + Material-UI
- Supabase (PostgreSQL + Auth)
- Express.js (백엔드 서버)
- Netlify (프론트엔드 배포)

---

## 📁 핵심 폴더 구조

```
crm-app/
├── src/              # 프론트엔드 소스
│   ├── components/   # UI 컴포넌트
│   ├── pages/        # 페이지 컴포넌트
│   ├── api/          # API 클라이언트
│   ├── utils/        # 유틸리티 함수
│   ├── config/       # 설정 파일
│   └── lib/          # 라이브러리 초기화
├── server/           # 백엔드 서버
├── supabase/         # 데이터베이스 마이그레이션
└── public/           # 정적 파일
```

---

## 🔑 주요 파일 위치

### 프론트엔드
- **라우팅**: `src/App.jsx`
- **레이아웃**: `src/components/Layout.jsx`
- **인증**: `src/contexts/AuthContext.jsx`
- **API 설정**: `src/lib/supabaseClient.js`
- **권한 설정**: `src/config/menuConfig.js`

### 백엔드
- **서버**: `server/index.js`
- **주문 자동화**: `server/playwrightOrderService.js`

### 데이터베이스
- **마이그레이션**: `supabase/migrations/`

---

## 🛠️ 개발 환경 설정

### 1. 의존성 설치

```bash
# 프론트엔드
npm install

# 백엔드
cd server
npm install
```

### 2. 환경 변수 설정

**로컬 개발:**
- `public/env.js` 파일 수정

**주요 환경 변수:**
- `REACT_APP_SUPABASE_URL`: Supabase 프로젝트 URL
- `REACT_APP_SUPABASE_ANON_KEY`: Supabase Anon Key
- `REACT_APP_GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID

### 3. 개발 서버 실행

```bash
# 프론트엔드 (포트 3000)
npm start

# 백엔드 (포트 5000, 별도 터미널)
cd server
npm start
```

---

## 📋 주요 기능

### 1. A/S 서비스 관리
- 서비스 등록/수정/삭제
- 부품 관리
- 영수증 업로드 및 OCR
- **위치**: `src/components/Service/`

### 2. 고객 관리
- 고객 등록/수정/삭제
- 고객 검색
- **위치**: `src/components/Customer/`

### 3. 출고 관리
- 출고 등록/수정
- 부품 출고 관리
- **위치**: `src/pages/shipment/`

### 4. 재고 관리
- 재고 조회
- 재고 로그
- **위치**: `src/components/Inventory/`

### 5. 주문 대기
- 주문 대기 목록
- 자동 주문 처리 (Playwright)
- **위치**: `src/pages/pendingOrders/`

### 6. 게시판
- 게시글 작성/수정/삭제
- **위치**: `src/pages/board/`

---

## 🔐 권한 관리

**이메일 기반 권한 시스템**

**설정 위치**: `src/config/menuConfig.js`

**권한 레벨:**
- `all`: 모든 메뉴 접근 (관리자)
- 배열: 지정된 메뉴만 접근

**예시:**
```javascript
'admin@xrider.com': 'all',  // 관리자
'service@xrider.com': [      // A/S 담당자
  'dashboard',
  'services',
  'customers'
]
```

---

## 🗄️ 데이터베이스

**Supabase 사용**

**주요 테이블:**
- `services`: A/S 서비스
- `customers`: 고객
- `products`: 제품
- `shipments`: 출고
- `inventory`: 재고
- `pending_orders`: 주문 대기
- `board_posts`: 게시판

**마이그레이션:**
- 위치: `supabase/migrations/`
- 날짜 형식: `YYYYMMDDHHMMSS_description.sql`

---

## 📡 API 구조

### 프론트엔드 → Supabase
- 직접 Supabase 클라이언트 사용
- 위치: `src/api/*.js`

### 프론트엔드 → 백엔드 서버
- Express.js API
- 주요 엔드포인트:
  - `POST /api/ocr`: OCR 처리
  - `POST /api/search-product`: 제품 검색
  - `POST /api/process-order`: 주문 처리

---

## 🚢 배포

### 프론트엔드 (Netlify)
1. `npm run build` 실행
2. `build/` 폴더 배포
3. 환경 변수 설정 (Netlify 대시보드)

### 백엔드
- 별도 서버에 배포 (Heroku, AWS 등)
- 환경 변수 설정 필요

---

## 🔍 문제 해결

### 환경 변수 문제
- `public/env.js` 확인
- Netlify 환경 변수 확인
- 브라우저 콘솔에서 `window._env_` 확인

### 인증 문제
- Supabase 프로젝트 설정 확인
- RLS 정책 확인

### API 오류
- 백엔드 서버 실행 확인
- CORS 설정 확인
- 네트워크 탭에서 요청 확인

---

## 📚 상세 문서

- **프로젝트 구조**: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **파일 참조**: [FILE_REFERENCE.md](./FILE_REFERENCE.md)
- **환경 변수**: [NETLIFY_ENV_VARIABLES.md](./NETLIFY_ENV_VARIABLES.md)
- **배포 가이드**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 💡 개발 팁

1. **컴포넌트 찾기**: `/src/components` 또는 `/src/pages`
2. **API 함수 찾기**: `/src/api`
3. **유틸리티 찾기**: `/src/utils`
4. **설정 변경**: `/src/config`
5. **DB 스키마 확인**: `/supabase/migrations`

---

**더 자세한 정보는 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)를 참조하세요.**

