# Playwright 주문 처리 가이드

## 개요

주문대기 시스템에서 실제로 웹사이트에 주문을 처리하려면 Playwright MCP 도구를 사용해야 합니다.

## 사용 방법

### 1. 상품 매칭

상품 매칭 다이얼로그에서 "웹사이트에서 상품 검색" 버튼을 클릭하면:
- Playwright MCP 도구를 사용하여 브라우저가 자동으로 열립니다
- 웹사이트에서 상품을 검색합니다
- 검색 결과를 표시합니다
- 매칭할 상품을 선택할 수 있습니다

### 2. 주문 처리

주문대기 상세 페이지에서 "주문 처리" 버튼을 클릭하면:
- Playwright MCP 도구를 사용하여 브라우저가 자동으로 열립니다
- 웹사이트에 로그인합니다
- 각 상품을 검색하고 장바구니에 추가합니다
- 장바구니로 이동하여 주문을 완료합니다
- 주문번호를 추출하여 저장합니다

## 실제 구현 방법

현재 코드는 구조만 정의되어 있습니다. 실제로 작동하도록 하려면:

### 방법 1: Playwright MCP 도구 직접 사용

`PendingOrderDetail.jsx`에서 Playwright MCP 도구를 직접 호출:

```javascript
// Playwright MCP 도구 import (실제 MCP 도구 함수명에 맞게 수정)
import {
  mcp_playwright_playwright_navigate as navigate,
  mcp_playwright_playwright_fill as fill,
  mcp_playwright_playwright_click as click,
  mcp_playwright_playwright_get_visible_text as getVisibleText,
  mcp_playwright_playwright_get_visible_html as getVisibleHtml,
  mcp_playwright_playwright_screenshot as screenshot
} from '@mcp/playwright';

// 상품 검색
const playwrightTools = { navigate, fill, click, getVisibleText, getVisibleHtml, screenshot };
const result = await searchProductWithPlaywright(
  playwrightTools,
  brand,
  partName,
  partCode,
  barcode
);

// 주문 처리
const orderResult = await processOrderWithPlaywrightMCP(
  playwrightTools,
  brand,
  orderItems
);
```

### 방법 2: 백엔드 API를 통한 실행

백엔드 서버에서 Playwright를 실행하고 API를 통해 호출:

```javascript
// 백엔드 API 호출
const response = await fetch('/api/orders/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand,
    orderItems
  })
});

const orderResult = await response.json();
```

## 웹사이트 셀렉터 수정

실제 웹사이트 구조에 맞게 `playwrightOrderHandler.js`의 셀렉터를 수정해야 합니다:

1. `BRAND_CONFIG`의 `selectors` 객체를 실제 웹사이트의 CSS 셀렉터로 업데이트
2. 로그인 폼의 셀렉터 수정
3. 검색 입력 필드 및 버튼 셀렉터 수정
4. 장바구니 추가 버튼 셀렉터 수정
5. 주문 완료 페이지의 주문번호 추출 로직 수정

## 테스트

1. 상품 매칭 테스트:
   - 주문대기 상세 페이지에서 상품 매칭 버튼 클릭
   - 웹사이트에서 상품 검색 확인
   - 검색 결과 표시 확인

2. 주문 처리 테스트:
   - 주문대기 상세 페이지에서 주문 처리 버튼 클릭
   - 브라우저 자동화 동작 확인
   - 주문 완료 및 주문번호 추출 확인

## 주의사항

- Playwright는 Node.js 환경에서 실행되어야 하므로, 프론트엔드에서 직접 실행하기 어렵습니다
- 백엔드 API를 통해 실행하거나, Playwright MCP 도구를 사용해야 합니다
- 실제 웹사이트 구조에 맞게 셀렉터를 수정해야 합니다
- 로그인 정보는 환경변수로 관리하는 것을 권장합니다

