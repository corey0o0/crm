# Playwright 주문 처리 설정 가이드

## 개요

주문대기 시스템에서 실제로 웹사이트에 주문을 처리하려면 백엔드 서버에서 Playwright를 실행해야 합니다.

## 설치 방법

### 1. 백엔드 서버에 Playwright 설치

```bash
cd server
npm install playwright
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

## 웹사이트 셀렉터 수정

실제 웹사이트 구조에 맞게 `server/playwrightOrderService.js`의 셀렉터를 수정해야 합니다:

1. `BRAND_CONFIG`의 `selectors` 객체를 실제 웹사이트의 CSS 셀렉터로 업데이트
2. 로그인 폼의 셀렉터 수정
3. 검색 입력 필드 및 버튼 셀렉터 수정
4. 장바구니 추가 버튼 셀렉터 수정
5. 주문 완료 페이지의 주문번호 추출 로직 수정

## 환경 변수 설정

`.env` 파일에 다음을 추가할 수 있습니다:

```
REACT_APP_API_URL=http://localhost:5000
```

프론트엔드에서 백엔드 API URL을 설정합니다.

## 테스트

1. 백엔드 서버 실행 확인:
   ```bash
   curl http://localhost:5000/api/health
   ```

2. 상품 검색 테스트:
   ```bash
   curl -X POST http://localhost:5000/api/orders/search-product \
     -H "Content-Type: application/json" \
     -d '{"brand":"XRB","partName":"부품명"}'
   ```

3. 주문 처리 테스트:
   ```bash
   curl -X POST http://localhost:5000/api/orders/process \
     -H "Content-Type: application/json" \
     -d '{"brand":"XRB","orderItems":[{"partName":"부품명","quantity":1}]}'
   ```

## 주의사항

- Playwright는 Node.js 환경에서 실행되어야 하므로 백엔드 서버에서 실행합니다
- 실제 웹사이트 구조에 맞게 셀렉터를 수정해야 합니다
- 로그인 정보는 환경변수로 관리하는 것을 권장합니다
- 브라우저가 자동으로 열리므로 (`headless: false`) 서버가 실행 중인 컴퓨터에서 확인할 수 있습니다

