# Playwright MCP 도구 직접 사용 가이드

## 개요

백엔드 서버 없이 Playwright MCP 도구를 직접 사용하여 웹사이트에서 주문을 처리할 수 있습니다.

## 작동 방식

1. **MCP 도구 직접 호출**: Cursor의 MCP 서버를 통해 Playwright MCP 도구를 직접 호출합니다.
2. **백엔드 불필요**: 백엔드 서버 없이 프론트엔드에서 직접 MCP 도구를 사용할 수 있습니다.
3. **자동 폴백**: MCP 도구를 사용할 수 없는 경우 기본 함수로 폴백합니다.

## 사용 방법

### 1. 상품 매칭

주문대기 상세 페이지에서:
1. 상품 매칭 버튼 클릭
2. "웹사이트에서 상품 검색" 버튼 클릭
3. MCP 도구가 자동으로 브라우저를 열고 상품을 검색합니다
4. 검색 결과를 표시하고 매칭할 상품을 선택합니다

### 2. 주문 처리

주문대기 상세 페이지에서:
1. 주문할 상품 선택
2. "주문 처리" 버튼 클릭
3. MCP 도구가 자동으로 브라우저를 열고 주문을 처리합니다
4. 주문 완료 후 주문번호를 추출하여 저장합니다

## 코드 구조

### MCP 도구 래퍼 (`src/utils/mcpPlaywrightTools.js`)

```javascript
// MCP 도구를 가져오는 함수
export const getPlaywrightTools = async () => {
  // MCP 도구를 직접 호출하는 래퍼 반환
  return {
    navigate: async (params) => {
      const { mcp_playwright_playwright_navigate } = await import('@mcp/playwright');
      return mcp_playwright_playwright_navigate(params);
    },
    // ... 기타 MCP 도구 함수들
  };
};
```

### 컴포넌트에서 사용 (`src/pages/pendingOrders/PendingOrderDetail.jsx`)

```javascript
// MCP 도구를 사용하여 상품 검색
try {
  const result = await searchProductWithMCP(brand, partName, partCode, barcode);
  // 결과 처리
} catch (mcpError) {
  // MCP 도구를 사용할 수 없는 경우 기본 함수 사용
  const result = await searchProductOnWebsite(brand, partName, partCode, barcode);
}
```

## 장점

1. **백엔드 불필요**: 별도의 백엔드 서버를 구축할 필요가 없습니다.
2. **간단한 설정**: MCP 도구만 설정하면 바로 사용할 수 있습니다.
3. **자동 폴백**: MCP 도구를 사용할 수 없는 경우 자동으로 기본 함수로 폴백합니다.

## 주의사항

1. **MCP 도구 설정**: Cursor의 MCP 서버에 Playwright MCP 도구가 설정되어 있어야 합니다.
2. **브라우저 자동화**: MCP 도구가 브라우저를 자동으로 열고 제어합니다.
3. **셀렉터 수정**: 실제 웹사이트 구조에 맞게 `playwrightOrderHandler.js`의 셀렉터를 수정해야 합니다.

## MCP 도구 설정

Cursor의 MCP 설정 파일에 Playwright MCP 서버가 설정되어 있어야 합니다:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp-server"]
    }
  }
}
```

## 문제 해결

### MCP 도구를 찾을 수 없는 경우

1. Cursor의 MCP 설정을 확인하세요.
2. Playwright MCP 서버가 설치되어 있는지 확인하세요.
3. MCP 서버가 실행 중인지 확인하세요.

### 브라우저가 열리지 않는 경우

1. Playwright가 설치되어 있는지 확인하세요: `npx playwright install chromium`
2. MCP 서버 로그를 확인하세요.
3. 브라우저 경로가 올바른지 확인하세요.

