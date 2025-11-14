# Playwright 백엔드 서버 사용 가이드

## 개요

Cursor MCP 도구 없이 백엔드 서버를 통해 Playwright를 실행하여 웹사이트에서 주문을 처리합니다.

## 작동 방식

1. **백엔드 서버**: Express 서버에서 Playwright를 실행합니다.
2. **프론트엔드**: 백엔드 API를 호출하여 주문을 처리합니다.
3. **MCP 불필요**: Cursor MCP 도구 없이 백엔드 서버만으로 작동합니다.

## 설치 방법

### 1. 백엔드 서버에 Playwright 설치

```bash
cd server
npm install
npx playwright install chromium
```

### 2. 백엔드 서버 실행

```bash
cd server
npm start
# 또는 개발 모드
npm run dev
```

서버는 기본적으로 `http://localhost:5000`에서 실행됩니다.

### 3. 환경 변수 설정 (선택사항)

프론트엔드에서 백엔드 API URL을 설정하려면 `.env` 파일에 추가:

```
REACT_APP_API_URL=http://localhost:5000
```

## 사용 방법

### 1. 상품 매칭

1. 주문대기 상세 페이지에서 상품 매칭 버튼 클릭
2. "웹사이트에서 상품 검색" 버튼 클릭
3. 백엔드 서버가 Playwright를 실행하여 브라우저가 자동으로 열립니다
4. 웹사이트에서 상품을 검색하고 결과를 표시합니다
5. 매칭할 상품을 선택합니다

### 2. 주문 처리

1. 주문대기 상세 페이지에서 주문할 상품 선택
2. "주문 처리" 버튼 클릭
3. 백엔드 서버가 Playwright를 실행하여 브라우저가 자동으로 열립니다
4. 웹사이트에 로그인하고 각 상품을 검색하여 장바구니에 추가합니다
5. 장바구니로 이동하여 주문을 완료합니다
6. 주문번호를 추출하여 저장합니다

## API 엔드포인트

### 상품 검색 API

**URL**: `POST /api/orders/search-product`

**Request Body**:
```json
{
  "brand": "XRB",
  "partName": "부품명",
  "partCode": "부품코드",
  "barcode": "바코드"
}
```

**Response**:
```json
{
  "success": true,
  "productId": "12345",
  "productName": "부품명",
  "options": ["옵션1", "옵션2"],
  "outOfStock": false,
  "productUrl": "https://www.xrider.co.kr/product/12345"
}
```

### 주문 처리 API

**URL**: `POST /api/orders/process`

**Request Body**:
```json
{
  "brand": "XRB",
  "orderItems": [
    {
      "itemId": "uuid",
      "partName": "부품명",
      "partCode": "부품코드",
      "quantity": 1,
      "options": {},
      "matchedProductId": "12345",
      "matchedProductName": "웹사이트 상품명",
      "status": "matched"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "orderId": "ORD-12345",
  "message": "주문이 완료되었습니다. 주문번호: ORD-12345"
}
```

## 실제 웹사이트 셀렉터 수정

실제 웹사이트 구조에 맞게 `server/playwrightOrderService.js`의 셀렉터를 수정해야 합니다:

1. `BRAND_CONFIG`의 `selectors` 객체를 실제 웹사이트의 CSS 셀렉터로 업데이트
2. 로그인 폼의 셀렉터 수정
3. 검색 입력 필드 및 버튼 셀렉터 수정
4. 장바구니 추가 버튼 셀렉터 수정
5. 주문 완료 페이지의 주문번호 추출 로직 수정

## 장점

1. **MCP 불필요**: Cursor MCP 도구 없이 작동합니다.
2. **독립적**: 백엔드 서버만 실행하면 됩니다.
3. **안정적**: 백엔드 서버에서 Playwright를 실행하므로 안정적입니다.

## 주의사항

1. **백엔드 서버 필요**: 백엔드 서버가 실행 중이어야 합니다.
2. **Playwright 설치**: 백엔드 서버에 Playwright가 설치되어 있어야 합니다.
3. **셀렉터 수정**: 실제 웹사이트 구조에 맞게 셀렉터를 수정해야 합니다.

## 문제 해결

### 백엔드 서버 연결 오류

1. 백엔드 서버가 실행 중인지 확인: `http://localhost:5000/api/health`
2. 환경 변수 `REACT_APP_API_URL`이 올바르게 설정되어 있는지 확인
3. CORS 설정이 올바른지 확인

### Playwright 설치 오류

```bash
# Playwright 재설치
cd server
npm uninstall playwright
npm install playwright
npx playwright install chromium
```

### 브라우저가 열리지 않는 경우

1. Playwright 브라우저가 설치되어 있는지 확인: `npx playwright install chromium`
2. 백엔드 서버 로그를 확인하세요
3. 브라우저 경로가 올바른지 확인하세요

### 셀렉터 오류

1. 실제 웹사이트의 HTML 구조를 확인
2. 브라우저 개발자 도구로 셀렉터 확인
3. `server/playwrightOrderService.js`의 셀렉터 수정

