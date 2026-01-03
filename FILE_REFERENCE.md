# 파일 참조 가이드

이 문서는 프로젝트의 주요 파일들의 역할과 사용법을 상세히 설명합니다.

---

## 📄 루트 파일

### `package.json`
**역할**: 프로젝트 메타데이터 및 의존성 관리

**주요 의존성:**
- `react`, `react-dom`: React 프레임워크
- `@mui/material`, `@mui/icons-material`: Material-UI 컴포넌트
- `@supabase/supabase-js`: Supabase 클라이언트
- `react-router-dom`: 라우팅
- `axios`: HTTP 클라이언트
- `tesseract.js`: OCR 처리
- `playwright`: 브라우저 자동화 (백엔드)

**주요 스크립트:**
- `npm start`: 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm test`: 테스트 실행

---

### `netlify.toml`
**역할**: Netlify 배포 설정

**주요 설정:**
- 빌드 명령어: `npm install && npm run build`
- 배포 폴더: `build`
- Node 버전: 18
- SPA 리다이렉션 규칙

---

## 📁 `/src` - 프론트엔드 소스

### `src/App.jsx`
**역할**: 메인 App 컴포넌트, 라우팅 설정

**주요 기능:**
- React Router 설정
- 인증 상태 확인
- 모든 라우트 정의
- Theme Provider 설정

**주요 라우트:**
- `/`: 대시보드
- `/login`: 로그인
- `/customers`: 고객 관리
- `/services`: A/S 서비스 목록
- `/services/:id`: A/S 서비스 상세
- `/add-service`: A/S 서비스 추가
- `/shipment`: 출고 관리 (새 버전)
- `/pending-orders`: 주문 대기
- `/board`: 게시판
- `/backup`: 백업 관리

---

### `src/index.js`
**역할**: React 앱 진입점

**주요 기능:**
- React DOM 렌더링
- 전역 스타일 적용

---

### `src/theme.js`
**역할**: Material-UI 테마 설정

**주요 설정:**
- 색상 팔레트
- 타이포그래피
- 컴포넌트 스타일 오버라이드

---

## 📁 `/src/components` - 컴포넌트

### 인증 관련

#### `src/components/Auth/Login.jsx`
**역할**: 로그인 페이지

**주요 기능:**
- 이메일/비밀번호 로그인
- Supabase Auth 연동
- 에러 처리

#### `src/components/Auth/ProtectedRoute.jsx`
**역할**: 인증이 필요한 라우트 보호

**사용법:**
```jsx
<ProtectedRoute>
  <YourComponent />
</ProtectedRoute>
```

---

### 고객 관리

#### `src/components/Customer/CustomerManagement.jsx`
**역할**: 고객 관리 메인 페이지

**주요 기능:**
- 고객 목록 표시
- 고객 추가/수정/삭제
- 고객 검색

#### `src/components/Customer/CustomerList.jsx`
**역할**: 고객 목록 컴포넌트

#### `src/components/Customer/AddCustomer.jsx`
**역할**: 고객 추가 폼

---

### A/S 서비스 관리

#### `src/components/Service/ServiceList.jsx`
**역할**: A/S 서비스 목록 페이지

**주요 기능:**
- 서비스 목록 표시
- 필터링 및 검색
- 정렬 기능

#### `src/components/Service/AddService.jsx`
**역할**: A/S 서비스 등록 페이지

**주요 기능:**
- 서비스 기본 정보 입력
- 고객 선택
- 부품 선택
- 영수증 업로드

#### `src/components/Service/ServiceDetail.jsx`
**역할**: A/S 서비스 상세 정보 페이지

**주요 기능:**
- 서비스 상세 정보 표시
- 부품 목록 표시
- 영수증 표시
- 서비스 수정/삭제

#### `src/components/Service/PartsManagement.jsx`
**역할**: 부품 관리 페이지

**주요 기능:**
- 부품 목록 관리
- 부품 추가/수정/삭제
- 재고 확인

#### `src/components/Service/PartsSelectionDialog.jsx`
**역할**: 부품 선택 다이얼로그

**사용 시나리오:**
- A/S 서비스 등록 시 부품 선택
- 출고 시 부품 선택

---

### 출고 관리

#### `src/components/Product/ProductShipment.jsx` (기존)
**역할**: 기존 출고 관리 페이지

**참고**: 새 버전(`/pages/shipment/`)으로 대체 예정

#### `src/pages/shipment/ShipmentList.jsx` (새 버전)
**역할**: 출고 목록 페이지

#### `src/pages/shipment/ShipmentDetail.jsx` (새 버전)
**역할**: 출고 상세 정보 페이지

#### `src/pages/shipment/ShipmentForm.jsx` (새 버전)
**역할**: 출고 등록/수정 폼

---

### 대시보드

#### `src/components/Dashboard.jsx`
**역할**: 대시보드 메인 컴포넌트

**주요 기능:**
- 통계 요약 표시
- 최근 서비스 목록
- 알림 표시
- 메모 패널

#### `src/components/Dashboard/MemoPanel.jsx`
**역할**: 메모 패널 컴포넌트

**주요 기능:**
- 개인 메모 표시
- 공유 메모 표시
- 메모 추가/수정/삭제

#### `src/components/Dashboard/ServiceCalendar.jsx`
**역할**: 서비스 캘린더 컴포넌트

**주요 기능:**
- 서비스 일정 표시
- 날짜별 필터링

#### `src/components/Dashboard/NotificationBell.jsx`
**역할**: 알림 벨 컴포넌트

#### `src/components/Dashboard/NotificationToast.jsx`
**역할**: 알림 토스트 컴포넌트

---

### 레이아웃

#### `src/components/Layout.jsx`
**역할**: 메인 레이아웃 컴포넌트

**주요 기능:**
- 사이드바 메뉴
- 헤더
- 권한 기반 메뉴 표시
- 로그아웃 기능

**구조:**
- `Outlet`: 하위 라우트 렌더링
- `Menu`: 사이드바 메뉴
- `Header`: 상단 헤더

---

## 📁 `/src/api` - API 클라이언트

### `src/api/services.js`
**역할**: A/S 서비스 관련 API 함수

**주요 함수:**
- `getServices()`: 서비스 목록 조회
- `getService(id)`: 서비스 상세 조회
- `createService(data)`: 서비스 생성
- `updateService(id, data)`: 서비스 수정
- `deleteService(id)`: 서비스 삭제

**사용 예시:**
```javascript
import { getServices, createService } from '../api/services';

const services = await getServices();
const newService = await createService({ ... });
```

---

### `src/api/inventoryApi.js`
**역할**: 재고 관련 API 함수

**주요 함수:**
- `getInventory()`: 재고 목록 조회
- `getInventoryLogs()`: 재고 로그 조회
- `updateInventory()`: 재고 업데이트

---

### `src/api/productApi.js`
**역할**: 제품 관련 API 함수

**주요 함수:**
- `getProducts()`: 제품 목록 조회
- `getProduct(id)`: 제품 상세 조회
- `createProduct(data)`: 제품 생성

---

### `src/api/roleApi.js`
**역할**: 역할 관련 API 함수

**주요 함수:**
- `getRoles()`: 역할 목록 조회
- `assignRole()`: 역할 할당
- `removeRole()`: 역할 제거

---

## 📁 `/src/utils` - 유틸리티

### `src/utils/dateUtils.js`
**역할**: 날짜 처리 유틸리티

**주요 함수:**
- `formatDate()`: 날짜 포맷팅
- `parseDate()`: 날짜 파싱
- `addDays()`: 날짜 더하기

---

### `src/utils/excelUtils.js`
**역할**: Excel 파일 처리

**주요 함수:**
- `exportToExcel()`: 데이터를 Excel로 내보내기
- `importFromExcel()`: Excel에서 데이터 가져오기

---

### `src/utils/googleDriveUtils.js`
**역할**: Google Drive 연동

**주요 기능:**
- 파일 업로드
- 파일 다운로드
- 폴더 생성
- OAuth 인증

---

### `src/utils/playwrightOrderHandler.js`
**역할**: Playwright 주문 자동화 핸들러

**주요 기능:**
- 웹사이트 제품 검색
- 주문 자동 처리
- 에러 처리

---

### `src/utils/secureApiUtils.js`
**역할**: 보안 API 유틸리티

**주요 기능:**
- API 키 관리
- 요청 암호화
- 응답 검증

---

## 📁 `/src/config` - 설정

### `src/config/api.js`
**역할**: API 엔드포인트 설정

**주요 설정:**
- OpenAI API 설정
- 환경 변수 관리

**사용법:**
```javascript
import { API_CONFIG } from '../config/api';

const openaiEndpoint = API_CONFIG.OPENAI.ENDPOINT;
```

---

### `src/config/menuConfig.js`
**역할**: 메뉴 권한 설정

**구조:**
```javascript
export const MENU_CONFIG = {
  'admin@xrider.com': 'all',  // 모든 메뉴 접근
  'service@xrider.com': [      // 지정된 메뉴만 접근
    'dashboard',
    'services',
    'customers'
  ]
};
```

**사용법:**
- 이메일 기반 권한 관리
- `Layout.jsx`에서 사용하여 메뉴 표시 제어

---

### `src/config/securityConfig.js`
**역할**: 보안 설정

**주요 설정:**
- CORS 설정
- 인증 토큰 설정
- 보안 헤더 설정

---

## 📁 `/src/lib` - 라이브러리

### `src/lib/supabaseClient.js`
**역할**: Supabase 클라이언트 초기화

**주요 기능:**
- Supabase 클라이언트 생성
- 환경 변수에서 설정 읽기

**사용법:**
```javascript
import { supabase } from '../lib/supabaseClient';

const { data, error } = await supabase
  .from('services')
  .select('*');
```

---

### `src/lib/googleDriveConfig.js`
**역할**: Google Drive 설정

**주요 설정:**
- OAuth 클라이언트 ID
- 스코프 설정
- 리디렉션 URI

---

### `src/lib/telegram.js`
**역할**: 텔레그램 봇 설정

**주요 기능:**
- 봇 토큰 설정
- 메시지 전송 함수

---

### `src/lib/setupStorage.js`
**역할**: 스토리지 버킷 초기화

**주요 기능:**
- Supabase Storage 버킷 생성
- 권한 설정

---

## 📁 `/src/contexts` - Context

### `src/contexts/AuthContext.jsx`
**역할**: 인증 상태 관리

**주요 기능:**
- 사용자 정보 관리
- 세션 관리
- 로그인/로그아웃 함수

**사용법:**
```javascript
import { useAuth } from '../contexts/AuthContext';

const { user, session, signIn, signOut } = useAuth();
```

---

## 📁 `/src/hooks` - Custom Hooks

### `src/hooks/useAutoSave.js`
**역할**: 자동 저장 훅

**주요 기능:**
- 폼 데이터 자동 저장
- 로컬 스토리지에 저장
- 복원 기능

**사용법:**
```javascript
import { useAutoSave } from '../hooks/useAutoSave';

const { value, setValue } = useAutoSave('formKey', initialValue);
```

---

## 📁 `/server` - 백엔드

### `server/index.js`
**역할**: Express 서버 메인 파일

**주요 기능:**
- Express 앱 설정
- CORS 설정
- 파일 업로드 처리 (multer)
- API 엔드포인트 정의

**주요 엔드포인트:**
- `POST /api/ocr`: OCR 처리
- `POST /api/search-product`: 제품 검색
- `POST /api/process-order`: 주문 처리
- `GET /api/health`: 헬스 체크

**파일 업로드:**
- `uploads/` 폴더에 저장
- 파일 크기 제한: 10MB
- 허용 형식: 이미지, PDF

---

### `server/playwrightOrderService.js`
**역할**: Playwright 주문 자동화 서비스

**주요 함수:**
- `searchProductOnWebsite()`: 웹사이트에서 제품 검색
- `processOrderOnWebsite()`: 주문 자동 처리

**사용 기술:**
- Playwright: 브라우저 자동화
- 헤드리스 브라우저 실행

---

### `server/package.json`
**역할**: 서버 의존성 관리

**주요 의존성:**
- `express`: 웹 프레임워크
- `playwright`: 브라우저 자동화
- `tesseract.js`: OCR 처리
- `pdf-parse`: PDF 파싱
- `multer`: 파일 업로드

---

## 📁 `/supabase/migrations` - 마이그레이션

### 마이그레이션 파일 명명 규칙
`YYYYMMDDHHMMSS_description.sql`

**예시:**
- `20250115_create_pending_orders_tables.sql`
- `20251124130000_optimize_slow_queries_indexes.sql`

### 주요 마이그레이션

#### `20240814_create_model_settings_table.sql`
**역할**: 모델 설정 테이블 생성

**테이블 구조:**
- `id`: UUID
- `model_name`: 모델명
- `settings`: JSONB 설정

---

#### `20250107_create_inventory_tables.sql`
**역할**: 재고 관련 테이블 생성

**생성 테이블:**
- `inventory`: 재고 정보
- `inventory_logs`: 재고 로그

---

#### `20250115_create_pending_orders_tables.sql`
**역할**: 주문 대기 테이블 생성

**생성 테이블:**
- `pending_orders`: 주문 대기 정보
- 관련 인덱스 및 RLS 정책

---

#### `20250411_create_role_permission_tables.sql`
**역할**: 역할 및 권한 테이블 생성

**생성 테이블:**
- `roles`: 역할
- `permissions`: 권한
- `user_roles`: 사용자-역할 매핑

---

#### `20251124130000_optimize_slow_queries_indexes.sql`
**역할**: 느린 쿼리 인덱스 최적화

**주요 작업:**
- 인덱스 추가
- 쿼리 성능 개선

---

## 📁 `/scripts` - 스크립트

### `scripts/generate-env.js`
**역할**: 환경 변수 생성 스크립트

**주요 기능:**
- Netlify 환경 변수 읽기
- `public/env.js` 파일 생성
- `window._env_` 객체로 접근 가능

**실행 시점:**
- `npm run build` 실행 시 자동 실행

---

### `scripts/inject-env.js`
**역할**: 환경 변수 주입 스크립트

**주요 기능:**
- HTML에 환경 변수 주입
- 런타임 환경 변수 설정

---

## 📄 루트 SQL 파일

### `create_brand_settings_table.sql`
**역할**: 브랜드 설정 테이블 생성

**사용 시나리오:**
- 수동으로 실행하여 브랜드 설정 테이블 생성
- 마이그레이션으로 변환 권장

---

### `create_shipment_parts_table.sql`
**역할**: 출고 부품 테이블 생성

**테이블 구조:**
- `id`: UUID
- `shipment_id`: 출고 ID (외래키)
- `part_id`: 부품 ID
- `quantity`: 수량

---

### `check_model_settings_schema.sql`
**역할**: 모델 설정 스키마 확인

**사용 시나리오:**
- 데이터베이스 스키마 확인
- 디버깅용

---

## 📄 문서 파일

### `README.md`
**역할**: 프로젝트 개요 및 기본 사용법

**주요 내용:**
- 프로젝트 소개
- 설치 방법
- 실행 방법
- Google Drive 연동 설정

---

### `NETLIFY_ENV_VARIABLES.md`
**역할**: Netlify 환경 변수 설정 가이드

**주요 내용:**
- 필요한 환경 변수 목록
- 설정 방법
- 각 변수의 역할

---

### `DEPLOYMENT_GUIDE.md`
**역할**: 배포 가이드

**주요 내용:**
- 배포 절차
- 환경 설정
- 문제 해결

---

### `ROLE_PERMISSION_GUIDE.md`
**역할**: 역할 및 권한 가이드

**주요 내용:**
- 권한 시스템 설명
- 역할 설정 방법
- 메뉴 권한 설정

---

## 🔍 파일 찾기 가이드

### 특정 기능을 찾을 때

1. **UI 컴포넌트**: `/src/components` 또는 `/src/pages`
2. **API 호출**: `/src/api`
3. **유틸리티 함수**: `/src/utils`
4. **설정**: `/src/config`
5. **데이터베이스**: `/supabase/migrations`
6. **백엔드 로직**: `/server`

### 예시

**고객 목록을 표시하는 컴포넌트 찾기:**
→ `/src/components/Customer/CustomerList.jsx`

**고객 API 호출 함수 찾기:**
→ `/src/api` 폴더 확인 (또는 `services.js`에 포함될 수 있음)

**재고 관련 유틸리티 찾기:**
→ `/src/utils/inventoryUtils.js`

**데이터베이스 스키마 확인:**
→ `/supabase/migrations` 폴더의 마이그레이션 파일

---

## 📝 파일 수정 시 주의사항

### 1. 컴포넌트 수정
- Props 타입 확인
- 상태 관리 확인
- 에러 처리 추가

### 2. API 함수 수정
- Supabase 쿼리 최적화
- 에러 처리 추가
- 타입 확인

### 3. 마이그레이션 추가
- 날짜 형식 준수
- 롤백 가능하도록 작성
- RLS 정책 추가 확인

### 4. 환경 변수 추가
- `public/env.js` 수정
- `scripts/generate-env.js` 수정
- Netlify 환경 변수 설정

---

**최종 업데이트**: 2025년 1월
**문서 버전**: 1.0

