# CRM 시스템 인프라 및 배포 설정 가이드 (Infrastructure & Deployment Guide)

이 문서는 본 CRM 프로젝트(Frontend, Backend, Database)의 작동 원리와 각 플랫폼(Netlify, Railway, Supabase)의 연동 설정 및 배포 방법을 기록한 문서입니다.

---

## 1. 프론트엔드 (Frontend) - Netlify
*   **사용 프레임워크:** React (Create React App)
*   **호스팅 플랫폼:** Netlify
*   **운영 URL:** `https://crmapp8893.netlify.app`
*   **깃허브 연동 브랜치:** `main`

### 💡 배포 방법 (Deployment)
깃허브 `main` 브랜치에 코드가 푸시될 때마다 Netlify에서 변경 사항을 감지하여 **자동으로 빌드 및 배포**를 수행합니다. 수동 배포가 필요한 경우 Netlify 대시보드에서 `Trigger Deploy` 버튼을 클릭할 수 있습니다.

### ⚙️ 환경변수 설정 (`.env`)
Netlify 프로젝트 설정(Site settings > Environment variables)에 다음 키들이 등록되어 있어야 백엔드 및 외부 API와 정상 통신합니다.
*   `REACT_APP_SUPABASE_URL`: Supabase 프로젝트 URL (예: `https://fextlagqverlrajlmkon.supabase.co`)
*   `REACT_APP_SUPABASE_ANON_KEY`: Supabase 익명 퍼블릭 키
*   `REACT_APP_BACKEND_URL`: Railway 백엔드 서버의 퍼블릭 주소 (로컬 구동 시엔 생략 가능하되, 운영 환경에서는 필수 세팅)
*   기타(Telegram, OpenAI, Claude 등 외부 키 스펙)

---

## 2. 백엔드 (Backend) - Railway
*   **사용 언어/런타임:** Node.js (Express 기반 API 서버)
*   **호스팅 플랫폼:** Railway.app
*   **루트 디렉토리 설정:** 깃허브 저장소의 `/server` 폴더 내부 코드가 구동됨

### 💡 배포 방법 (Deployment)
Netlify와 마찬가지로 깃허브 `main` 브랜치 업데이트 시 **자동 배포(Auto Deploy)** 가 수 분 내로 이루어집니다. 
만약 업데이트가 즉시 반영되지 않으면 아래와 같이 대처합니다:
1. Railway 대시보드에 로그인 후 프로젝트 클릭
2. 최신 커밋 리스트 창에서 `Trigger Deploy` 또는 `New Deploy` 클릭 (수동 재배포)
3. 로컬에서 수동 배포 시 터미널에서 `server` 폴더로 이동 후 `railway up --detach` (Railway CLI 설치 필요)

### ⚙️ 환경변수 설정 (`server/.env`)
Railway 대시보드의 **Variables** 탭에 다음 설정들이 필수적으로 입력되어 있어야 DB 접속 및 Cafe24 동기화가 이루어집니다.
*   `PORT`: 5001 (또는 Railway 자동할당 포트)
*   `SUPABASE_URL`: DB URL (`https://fextlagqverlrajlmkon.supabase.co`)
*   `SUPABASE_SERVICE_KEY`: 권한 검사 우회용 관리자 인증키(Service Role 제한 권한) - 데이터 입력 및 수정용도. **절대 프론트엔드에 노출 금지**
*   `FRONTEND_URL`: CORS(교차 출처 리소스 공유) 허용을 위해 사용할 프론트 URL (`https://crmapp8893.netlify.app`)
*   `CAFE24_MALL_ID`, `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`: Cafe24 주문 동기화를 위한 OAuth 앱 인증키

---

## 3. 데이터베이스 (Database) - Supabase
*   **사용 기술:** PostgreSQL 기반의 BaaS
*   **호스팅 플랫폼:** Supabase
*   **프로젝트 주소:** `fextlagqverlrajlmkon`

### 💡 핵심 데이터 파이프라인(Schema) 정보
Supabase는 단순 DB를 넘어 RLS(행 단위 보안 체계)와 REST API 통신 방식을 자체 지원합니다.
*   **`cafe24_orders` 테이블:** Cafe24에서 동기화되는 주문서들. 
    *   **주의점:** 개별 품목(아이템) 목록은 `cafe24_order_items`라는 독립된 테이블로 존재하지 않고, `cafe24_orders`의 `order_items` 컬럼 안에 **JSONB 형태의 배열**로 차곡차곡 쌓여 관리됩니다. (수량, 상품가격, 결제금액 등을 포함)
*   **`parts` 테이블:** CRM에서 통합 관리하는 창고 재고 및 품목 마스터 데이터
*   **`cafe24_product_to_part` 테이블:** Cafe24 상품명(코드)과 `parts` 부품 간의 1:N 수동 동기화 매핑 테이블
*   **`agencies` 테이블:** 향후 "특별 회원/B2B 거래처" 주문 매핑 및 매출 전표 관리를 위해 활용될 거래처 명부

---

## 배포 흐름 구조도 (Workflow)
1. **개발 (로컬):** `crm-app` 루트에서 코드 작성 & 터미널 커밋 (`git add .` -> `git commit` -> `git push`)
2. **트리거 (Github):** `main` 브랜치에 코드가 업데이트 됨
3. **가동 (Hosting):**
   *   **Netlify:** React 코드를 빌드하여 새로운 스태틱 파일을 CDN에 배포 (UI 변경 시 즉시 반영)
   *   **Railway:** `/server` 내부를 감지해 Node 서버를 재부팅 및 5001번(혹은 임의) 포트에 할당 개방 (API, 동기화 스크립트 기능 추가/수정 시 즉시 반영)
   *   **Supabase:** 상시 가동 중이며 프론트/백엔드 서버 양쪽과 양방향 통신 처리 수행
