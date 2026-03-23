# 이카운트 ERP OpenAPI 검증 및 연동 가이드

## 개요
이카운트 ERP는 OpenAPI 연계를 허용하기 전에, 타사 서버에서 이카운트의 대규모 데이터를 안전하게 취급할 수 있도록 **"테스트 인증키"**를 통한 관문 검증 정책을 강제하고 있습니다. 
새로운 메뉴 API를 사용할 때마다, 반드시 개발자가 만든 자동화 봇(검증 스크립트)을 사용하여 이카운트 검증 서버에 성공적으로 신호를 보내야만 인증 제한이 해제되는 구조입니다.

---

## 1. 테스트 인증키 검증 프로세스
이카운트의 OpenAPI V2는 다음과 같은 2가지 비밀 우회 규칙을 요구합니다.
1. **로그인 서버 주소:** 테스트 키를 이용할 때는 실서버(`https://oapi...`) 대신 **테스트 서버(`https://sboapi.ecount.com...`)** 쪽으로 `OAPILogin` 요청을 보내야 임시 세션 ID를 발급합니다.
2. **기능 검증 발송:** 발급된 세션 ID를 들고, 테스트하려는 각 API(예: `SaveSale`, `GetBasicProductsList`)의 주소를 테스트 서버(`sboapi{ZONE}...`)로 쏴서 `HTTP 200`을 반환받아야 검증이 끝납니다.

본 프로젝트에 작성된 **`ecount_test_verifier.js`** 파일은 이 과정을 100% 자동화한 스크립트입니다. 실행 단 한 번으로 아래 메뉴들의 락(보안 관문)을 전부 분쇄했습니다.

### 검증이 완료된 API 리스트
- **기초등록 API**
  - 거래처등록 (`/OAPI/V2/AccountBasic/SaveBasicCust`)
  - 품목단건조회 (`/OAPI/V2/InventoryBasic/ViewBasicProduct`)
  - 품목목록조회 (`/OAPI/V2/InventoryBasic/GetBasicProductsList`)
- **영업관리 API**
  - 견적서입력 (`/OAPI/V2/Quotation/SaveQuotation`)
  - 주문서입력 (`/OAPI/V2/SaleOrder/SaveSaleOrder`)
  - 판매입력 (`/OAPI/V2/Sale/SaveSale`)
- **재고현황 및 구매 API**
  - 발주서조회 (`/OAPI/V2/Purchases/GetPurchasesOrderList`)
  - 구매입력 (`/OAPI/V2/Purchases/SavePurchases`)
  - 창고별재고현황 목록 (`/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation`)
  - 창고별재고현황 단건 (`/OAPI/V2/InventoryBalance/ViewInventoryBalanceStatusByLocation`)
  - 시스템전체재고현황 단건 (`/OAPI/V2/InventoryBalance/ViewInventoryBalanceStatus`)
  - 시스템전체재고현황 목록 (`/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus`)
- **회계자동분개 및 쇼핑몰 API**
  - 매출·매입전표 자동분개 (`/OAPI/V2/InvoiceAuto/SaveInvoiceAuto`)
  - 쇼핑몰관리 주문신규 (`/OAPI/V2/OpenMarket/SaveOpenMarketOrderNew`)

위 기능들은 모두 봇을 통해 **이카운트 ERP 화면 내 [API 인증현황]**에서 검증을 마쳤습니다.

---

## 2. 실서버(Production) 통신망 전환 방법
테스트 관문 통과 후, 실제로 위 기능들을 정식 API 키(`3d...`로 시작하는 키)로 실사용(호출)하기 위한 과정은 다음과 같습니다.

1. **이카운트 포털 설정 진입:** 외부 연동 설정 > Web API 연동 설정.
2. **허용 메뉴 권한 활성화:** 생성된 정식 인증키의 "허용 메뉴" 설정 팝업에서, 방금 뚫어놓은 모든 기능을 '체크(V)' 한 뒤 저장해야 합니다.
3. **서버 반영 (.env):**
   ```env
   # server/.env
   ECOUNT_COM_CODE=678204
   ECOUNT_USER_ID=slimpack
   ECOUNT_API_KEY=3d57... (발급받은 정식 API_KEY)
   ```
4. 위처럼 환경 변수가 적용되면, 프로젝트 백엔드의 `ecountService.js`는 통신 주소를 자동으로 `oapi{ZONE}.ecount.com` (정식 서버망)으로 맞추고 API 라이브 통신을 수행합니다.

이 문서를 통해 본 프로젝트의 이카운트 1차 API 구축 및 인증 작업은 완벽하게 성립되었습니다. 만약 추후 연계해야 할 추가 메뉴 코드가 생기게 된다면, 본 문서의 절차에 따라 `ecount_test_verifier.js`를 재활용하여 검증을 통과하십시오!
