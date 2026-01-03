# 프로젝트 구조 문서

이 문서는 CRM 애플리케이션의 전체 구조와 각 폴더/파일의 역할을 설명합니다.

## 📁 프로젝트 개요

이 프로젝트는 React 기반의 CRM(고객 관계 관리) 애플리케이션으로, A/S 서비스 관리, 재고 관리, 주문 관리 등의 기능을 제공합니다.

**주요 기술 스택:**
- **프론트엔드**: React 18, Material-UI, React Router
- **백엔드**: Express.js (Node.js)
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth
- **배포**: Netlify (프론트엔드), 별도 서버 (백엔드)

---

## 📂 폴더 구조

```
crm-app/
├── build/                    # 빌드 결과물 (배포용)
├── public/                   # 정적 파일
├── server/                   # 백엔드 서버
├── src/                      # 프론트엔드 소스 코드
├── supabase/                 # 데이터베이스 마이그레이션
├── scripts/                  # 빌드 스크립트
└── [루트 파일들]            # 설정 및 문서 파일
```

---

## 📂 상세 폴더 구조 및 설명

### 1. `/build` - 빌드 결과물

**역할**: 프로덕션 빌드 결과물이 저장되는 폴더

**주요 파일:**
- `index.html`: 메인 HTML 파일
- `env.js`: 런타임 환경 변수 (빌드 시 생성)
- `static/`: CSS, JS 번들 파일

**주의사항**: 
- `.gitignore`에 포함되어 있어 Git에 커밋되지 않음
- Netlify 배포 시 이 폴더가 배포됨

---

### 2. `/public` - 정적 파일

**역할**: 빌드 과정에서 그대로 복사되는 정적 파일들

**주요 파일:**
- `index.html`: React 앱의 진입점 HTML
- `env.js`: 환경 변수 설정 파일 (런타임에 로드)
- `google-auth-callback.html`: Google OAuth 콜백 페이지
- `favicon.ico`, `logo*.png`: 아이콘 및 로고
- `manifest.json`: PWA 설정 파일

**특징**:
- `env.js`는 빌드 시 `scripts/generate-env.js`에 의해 생성됨
- 환경 변수는 `window._env_` 객체로 접근 가능

---

### 3. `/server` - 백엔드 서버

**역할**: Express.js 기반 백엔드 서버 (파일 처리, OCR, 주문 자동화 등)

**주요 파일:**

#### `index.js`
- Express 서버 메인 파일
- API 엔드포인트 정의
- 파일 업로드 처리 (multer)
- PDF/이미지 OCR 처리 (Tesseract.js, Cloudmersive API)
- Playwright 기반 주문 자동화 API

#### `playwrightOrderService.js`
- Playwright를 사용한 웹사이트 주문 자동화 서비스
- 제품 검색 및 주문 처리 로직

#### `package.json`
- 서버 의존성 관리
- 주요 의존성: express, playwright, tesseract.js, pdf-parse 등

#### `uploads/`
- 업로드된 파일 임시 저장 폴더
- OCR 처리용 이미지/PDF 파일 저장

#### `setup.sh` / `setup.bat`
- 서버 환경 설정 스크립트

#### `Dockerfile`
- Docker 컨테이너 빌드 설정

**주요 API 엔드포인트:**
- `POST /api/ocr`: 이미지/PDF OCR 처리
- `POST /api/search-product`: 웹사이트에서 제품 검색
- `POST /api/process-order`: 주문 자동화 처리
- `GET /api/health`: 서버 상태 확인

---

### 4. `/src` - 프론트엔드 소스 코드

프론트엔드의 모든 소스 코드가 포함된 폴더입니다.

#### 4.1 `/src/components` - React 컴포넌트

**역할**: 재사용 가능한 UI 컴포넌트들

**주요 컴포넌트 폴더:**

##### `/src/components/Auth/`
- `Login.jsx`: 로그인 페이지
- `ProtectedRoute.jsx`: 인증이 필요한 라우트 보호
- `PermissionRoute.jsx`: 권한 기반 라우트 보호
- `SimplePermissionRoute.jsx`: 간단한 권한 체크 라우트

##### `/src/components/Customer/`
- `CustomerManagement.jsx`: 고객 관리 메인 페이지
- `CustomerList.jsx`: 고객 목록 표시
- `AddCustomer.jsx`: 고객 추가 폼

##### `/src/components/Service/`
- `ServiceList.jsx`: A/S 서비스 목록
- `AddService.jsx`: A/S 서비스 추가
- `ServiceDetail.jsx`: A/S 서비스 상세 정보
- `ServiceStatistics.jsx`: A/S 통계
- `PartsManagement.jsx`: 부품 관리
- `PartsSelectionDialog.jsx`: 부품 선택 다이얼로그
- `ReceiptUploadSection.jsx`: 영수증 업로드 섹션
- `ShipmentDetail.jsx`: 출고 상세 정보
- `FormBasicInfo.jsx`: 기본 정보 입력 폼
- `CustomerSearchModal.jsx`: 고객 검색 모달
- `CustomerHistoryDialog.jsx`: 고객 이력 다이얼로그

##### `/src/components/Product/`
- `ProductList.jsx`: 제품 목록
- `ProductShipment.jsx`: 제품 출고 관리 (기존)

##### `/src/components/Inventory/`
- `InventoryManagement.jsx`: 재고 관리 (비활성화됨)
- `InventoryLogs.jsx`: 재고 로그 조회
- `LocationManagement.jsx`: 위치 관리
- `BarcodeScanner.jsx`: 바코드 스캐너

##### `/src/components/Receipt/`
- `ReceiptList.jsx`: 영수증 목록
- `ReceiptScanner.jsx`: 영수증 스캐너
- `ReceiptAnalysis.jsx`: 영수증 분석

##### `/src/components/Dashboard/`
- `Dashboard.jsx`: 대시보드 메인
- `MemoPanel.jsx`: 메모 패널
- `ServiceCalendar.jsx`: 서비스 캘린더
- `NotificationBell.jsx`: 알림 벨
- `NotificationToast.jsx`: 알림 토스트

##### `/src/components/Settings/`
- `BrandSettings.jsx`: 브랜드 설정
- `RoleManagement.jsx`: 역할 관리 (이메일 기반으로 대체됨)

##### `/src/components/Backup/`
- `BackupManager.jsx`: 데이터 백업/복원 관리

##### `/src/components/Stats/`
- `ServiceStats.jsx`: 서비스 통계
- `SalesStats.jsx`: 판매 통계

##### `/src/components/Test/`
- `GoogleDriveTest.jsx`: Google Drive 연동 테스트
- `SystemHealthCheck.jsx`: 시스템 상태 확인
- `TelegramTest.jsx`: 텔레그램 봇 테스트

##### `/src/components/common/`
- `ResponsiveTable.jsx`: 반응형 테이블 컴포넌트

##### 기타 컴포넌트
- `Layout.jsx`: 메인 레이아웃 (사이드바, 헤더 포함)
- `Dashboard.jsx`: 대시보드 (별도 컴포넌트)
- `DebugPanel.jsx`: 디버그 패널
- `ConnectionStatus.jsx`: 연결 상태 표시

#### 4.2 `/src/pages` - 페이지 컴포넌트

**역할**: 라우트에 직접 연결되는 페이지 컴포넌트들

##### `/src/pages/admin/`
- `AdminTools.jsx`: 관리자 도구 페이지

##### `/src/pages/board/`
- `BoardList.jsx`: 게시판 목록
- `BoardNew.jsx`: 게시글 작성
- `BoardDetail.jsx`: 게시글 상세
- `BoardEdit.jsx`: 게시글 수정

##### `/src/pages/pendingOrders/`
- `PendingOrderList.jsx`: 주문 대기 목록
- `PendingOrderDetail.jsx`: 주문 대기 상세
- `PlaywrightOrderGuide.md`: Playwright 주문 가이드 문서

##### `/src/pages/shipment/`
- `ShipmentList.jsx`: 출고 목록 (새 버전)
- `ShipmentDetail.jsx`: 출고 상세 (새 버전)
- `ShipmentForm.jsx`: 출고 등록/수정 폼 (새 버전)

#### 4.3 `/src/api` - API 클라이언트

**역할**: Supabase 및 외부 API 호출 함수들

**주요 파일:**
- `services.js`: A/S 서비스 관련 API
- `dealerApi.js`: 딜러 관련 API
- `inventoryApi.js`: 재고 관련 API
- `productApi.js`: 제품 관련 API
- `roleApi.js`: 역할 관련 API
- `transactionApi.js`: 거래 관련 API
- `warehouseApi.js`: 창고 관련 API

#### 4.4 `/src/utils` - 유틸리티 함수

**역할**: 재사용 가능한 유틸리티 함수들

**주요 파일:**
- `backupUtils.js`: 백업 관련 유틸리티
- `browserAutomationOptions.js`: 브라우저 자동화 옵션
- `cacheUtils.js`: 캐시 관리
- `cookieUtils.js`: 쿠키 관리
- `dateUtils.js`: 날짜 처리
- `excelUtils.js`: Excel 파일 처리
- `fileDownloadUtils.js`: 파일 다운로드
- `googleDriveUtils.js`: Google Drive 연동
- `inventoryUtils.js`: 재고 관련 유틸리티
- `mcpPlaywrightTools.js`: MCP Playwright 도구
- `networkUtils.js`: 네트워크 유틸리티
- `orderAutomation.js`: 주문 자동화
- `pendingOrderUtils.js`: 주문 대기 관련 유틸리티
- `phoneUtils.js`: 전화번호 처리
- `playwrightOrderHandler.js`: Playwright 주문 핸들러
- `restApiUtils.js`: REST API 유틸리티
- `secureApiUtils.js`: 보안 API 유틸리티
- `secureLogging.js`: 보안 로깅
- `securityUtils.js`: 보안 유틸리티
- `setupStorage.js`: 스토리지 초기화
- `syncUtils.js`: 동기화 유틸리티

#### 4.5 `/src/config` - 설정 파일

**역할**: 애플리케이션 설정 파일들

**주요 파일:**
- `api.js`: API 엔드포인트 설정 (OpenAI 등)
- `menuConfig.js`: 메뉴 권한 설정 (이메일 기반)
- `securityConfig.js`: 보안 설정

#### 4.6 `/src/contexts` - React Context

**역할**: 전역 상태 관리

**주요 파일:**
- `AuthContext.jsx`: 인증 상태 관리 (사용자 정보, 세션)
- `AuthContext.jsx.backup`: 백업 파일

#### 4.7 `/src/lib` - 라이브러리 설정

**역할**: 외부 라이브러리 초기화 및 설정

**주요 파일:**
- `supabaseClient.js`: Supabase 클라이언트 초기화
- `googleDriveConfig.js`: Google Drive 설정
- `telegram.js`: 텔레그램 봇 설정
- `setupStorage.js`: 스토리지 버킷 초기화

#### 4.8 `/src/hooks` - Custom Hooks

**역할**: 재사용 가능한 React Hooks

**주요 파일:**
- `useAutoSave.js`: 자동 저장 훅

#### 4.9 기타 파일

- `App.jsx`: 메인 App 컴포넌트 (라우팅 설정)
- `index.js`: React 앱 진입점
- `theme.js`: Material-UI 테마 설정
- `setupProxy.js`: 개발 서버 프록시 설정
- `App.css`, `index.css`: 전역 스타일

---

### 5. `/supabase/migrations` - 데이터베이스 마이그레이션

**역할**: Supabase 데이터베이스 스키마 변경 이력

**주요 마이그레이션 파일:**

#### 테이블 생성
- `20240814_create_model_settings_table.sql`: 모델 설정 테이블
- `20250107_create_inventory_tables.sql`: 재고 관련 테이블
- `20250115_create_pending_orders_tables.sql`: 주문 대기 테이블
- `20250411_create_role_permission_tables.sql`: 역할 및 권한 테이블
- `20250816_create_board_posts_table.sql`: 게시판 테이블
- `20250930_create_products_table.sql`: 제품 테이블
- `20251125000000_create_backup_settings_table.sql`: 백업 설정 테이블

#### 메모 관련
- `create_user_memos.sql`: 사용자 메모 테이블
- `create_shared_memos.sql`: 공유 메모 테이블
- `20250411031222_update_user_memos.sql`: 사용자 메모 업데이트

#### 보안 및 최적화
- `20251124090000_enable_notifications_rls.sql`: 알림 RLS 활성화
- `20251124093000_enable_missing_rls.sql`: 누락된 RLS 활성화
- `20251124101500_fix_policy_initplans.sql`: 정책 최적화
- `20251124112000_optimize_rls_policies.sql`: RLS 정책 최적화
- `20251124123000_set_function_search_path.sql`: 함수 검색 경로 설정
- `20251124124500_add_missing_fk_indexes.sql`: 외래키 인덱스 추가
- `20251124130000_optimize_slow_queries_indexes.sql`: 느린 쿼리 인덱스 최적화

#### 역할 관리
- `create_master_admin.sql`: 마스터 관리자 생성
- `create_role_helper_functions.sql`: 역할 헬퍼 함수
- `assign_role_by_email.sql`: 이메일로 역할 할당
- `assign_multiple_roles.sql`: 다중 역할 할당
- `remove_user_role.sql`: 사용자 역할 제거
- `view_user_roles.sql`: 사용자 역할 조회
- `add_backup_permission_to_admin.sql`: 관리자 백업 권한 추가

#### 유틸리티
- `check_memo_tables.sql`: 메모 테이블 확인

**마이그레이션 실행 순서:**
- 날짜 순서대로 실행됨 (파일명의 타임스탬프 기준)
- Supabase CLI 또는 대시보드에서 실행

---

### 6. `/scripts` - 빌드 스크립트

**역할**: 빌드 및 배포 관련 스크립트

**주요 파일:**
- `generate-env.js`: 환경 변수 생성 스크립트 (빌드 시 실행)
- `inject-env.js`: 환경 변수 주입 스크립트

**사용법:**
- `npm run build` 실행 시 자동으로 `generate-env.js` 실행
- `public/env.js` 파일 생성

---

### 7. 루트 파일들

#### 설정 파일

##### `package.json`
- 프로젝트 메타데이터 및 의존성
- 주요 의존성: React, Material-UI, Supabase, React Router 등
- 스크립트: `start`, `build`, `test`

##### `netlify.toml`
- Netlify 배포 설정
- 빌드 명령어 및 환경 변수 설정
- 리다이렉션 규칙 (SPA 라우팅)

##### `server-proxy.js`
- 개발 서버 프록시 설정 (백엔드 서버 연결)

##### `env.sh`
- 환경 변수 설정 스크립트

#### SQL 파일 (루트)

**역할**: 데이터베이스 스키마 확인 및 수정용 SQL 스크립트

**주요 파일:**
- `create_brand_settings_table.sql`: 브랜드 설정 테이블 생성
- `create_service_files_table.sql`: 서비스 파일 테이블 생성
- `create_shipment_parts_table.sql`: 출고 부품 테이블 생성
- `alter_shipment_parts_table.sql`: 출고 부품 테이블 수정
- `add_memo_names.sql`: 메모 이름 추가
- `inventory_logs_table.sql`: 재고 로그 테이블
- `create_backup_settings_and_history.sql`: 백업 설정 및 이력 테이블
- `check_model_settings_schema.sql`: 모델 설정 스키마 확인
- `check_shipment_parts_schema.sql`: 출고 부품 스키마 확인
- `repair_shipment_parts_data.sql`: 출고 부품 데이터 수정
- `fix_services_rls_policy.sql`: 서비스 RLS 정책 수정

**참고**: 이 파일들은 수동으로 실행하거나 마이그레이션으로 변환하여 사용

#### 문서 파일

**주요 문서:**
- `README.md`: 프로젝트 개요 및 기본 사용법
- `NETLIFY_ENV_VARIABLES.md`: Netlify 환경 변수 설정 가이드
- `DEPLOYMENT_GUIDE.md`: 배포 가이드
- `SECURITY_IMPLEMENTATION_PLAN.md`: 보안 구현 계획
- `ROLE_PERMISSION_GUIDE.md`: 역할 및 권한 가이드
- `PLAYWRIGHT_SETUP.md`: Playwright 설정 가이드
- `MEMO_IMPLEMENTATION_STEPS.md`: 메모 기능 구현 단계
- 기타 기능별 가이드 문서들

---

## 🔄 주요 워크플로우

### 1. 개발 환경 설정

```bash
# 프론트엔드 의존성 설치
npm install

# 백엔드 서버 의존성 설치
cd server
npm install

# 환경 변수 설정
# public/env.js 파일 수정 또는 .env 파일 생성
```

### 2. 로컬 개발 실행

```bash
# 프론트엔드 개발 서버 실행
npm start
# http://localhost:3000

# 백엔드 서버 실행 (별도 터미널)
cd server
npm start
# http://localhost:5000
```

### 3. 빌드 및 배포

```bash
# 프로덕션 빌드
npm run build

# Netlify에 배포 (자동 또는 수동)
# netlify.toml 설정에 따라 자동 배포
```

---

## 🔐 보안 및 권한 관리

### 인증
- Supabase Auth 사용
- 이메일/비밀번호 로그인
- 세션 기반 인증

### 권한 관리
- 이메일 기반 권한 시스템 (`src/config/menuConfig.js`)
- 역할별 메뉴 접근 제어
- RLS (Row Level Security) 정책으로 데이터 접근 제어

### 주요 권한 레벨:
- `all`: 모든 메뉴 접근 (관리자)
- 배열: 지정된 메뉴만 접근 (일반 사용자)

---

## 📊 데이터베이스 구조

### 주요 테이블:
- `services`: A/S 서비스 정보
- `customers`: 고객 정보
- `products`: 제품 정보
- `shipments`: 출고 정보
- `shipment_parts`: 출고 부품 정보
- `inventory`: 재고 정보
- `inventory_logs`: 재고 로그
- `pending_orders`: 주문 대기
- `board_posts`: 게시판 게시글
- `user_memos`: 사용자 메모
- `shared_memos`: 공유 메모
- `roles`: 역할
- `permissions`: 권한
- `user_roles`: 사용자-역할 매핑

---

## 🛠️ 유지보수 가이드

### 새 기능 추가 시

1. **컴포넌트 추가**
   - `/src/components` 또는 `/src/pages`에 컴포넌트 생성
   - `App.jsx`에 라우트 추가

2. **API 추가**
   - `/src/api`에 API 함수 추가
   - Supabase 함수 또는 REST API 호출

3. **데이터베이스 변경**
   - `/supabase/migrations`에 마이그레이션 파일 생성
   - 날짜 형식: `YYYYMMDDHHMMSS_description.sql`

4. **환경 변수 추가**
   - `public/env.js` 또는 `scripts/generate-env.js` 수정
   - Netlify 환경 변수 설정 업데이트

### 코드 스타일

- React 함수형 컴포넌트 사용
- Material-UI 컴포넌트 활용
- ES6+ 문법 사용
- 한국어 주석 허용

### 파일 명명 규칙

- 컴포넌트: PascalCase (예: `CustomerList.jsx`)
- 유틸리티: camelCase (예: `dateUtils.js`)
- 상수: UPPER_SNAKE_CASE (예: `API_CONFIG`)

---

## 📝 참고 사항

1. **환경 변수 관리**
   - 로컬: `public/env.js` 수정
   - 배포: Netlify 환경 변수 설정
   - 런타임 접근: `window._env_` 객체

2. **백엔드 서버**
   - 별도 서버로 운영 (Express.js)
   - CORS 설정 필요
   - 파일 업로드 및 OCR 처리 담당

3. **데이터베이스**
   - Supabase 사용
   - 마이그레이션은 날짜 순서대로 실행
   - RLS 정책으로 보안 관리

4. **배포**
   - 프론트엔드: Netlify
   - 백엔드: 별도 서버 (Heroku, AWS 등)
   - 환경 변수는 각 플랫폼에서 설정

---

## 🔗 관련 문서

- [Netlify 환경 변수 가이드](./NETLIFY_ENV_VARIABLES.md)
- [배포 가이드](./DEPLOYMENT_GUIDE.md)
- [역할 및 권한 가이드](./ROLE_PERMISSION_GUIDE.md)
- [Playwright 설정 가이드](./PLAYWRIGHT_SETUP.md)

---

**최종 업데이트**: 2025년 1월
**문서 버전**: 1.0

