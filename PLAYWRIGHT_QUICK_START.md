# Playwright 빠른 시작 가이드 (백엔드 없이 MCP 도구 사용)

## 현재 상태

✅ 코드는 이미 Playwright MCP 도구를 직접 사용하도록 구성되어 있습니다.
✅ 백엔드 서버 없이 Cursor의 MCP 서버를 통해 Playwright를 실행합니다.

## 작동 방식

1. **MCP 도구 직접 호출**: Cursor의 MCP 서버를 통해 Playwright MCP 도구를 직접 호출합니다.
2. **백엔드 불필요**: 백엔드 서버 없이 프론트엔드에서 직접 MCP 도구를 사용합니다.
3. **자동 폴백**: MCP 도구를 사용할 수 없는 경우 기본 함수로 폴백합니다.

## 다음 단계

### 1. MCP 도구 설정 확인

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

### 2. Playwright 브라우저 설치 (MCP 서버에서 자동 설치됨)

MCP 서버가 자동으로 Playwright 브라우저를 설치합니다.

### 3. 실제 웹사이트 셀렉터 수정

실제 웹사이트 구조에 맞게 `src/utils/playwrightOrderHandler.js`의 셀렉터를 수정해야 합니다:

#### X-RIDER (www.xrider.co.kr)
- 로그인 폼 셀렉터
- 검색 입력 필드 및 버튼 셀렉터
- 장바구니 추가 버튼 셀렉터
- 주문 완료 페이지의 주문번호 추출 로직

#### NEARBIKE (www.nearbike.co.kr)
- 로그인 폼 셀렉터
- 검색 입력 필드 및 버튼 셀렉터
- 장바구니 추가 버튼 셀렉터
- 주문 완료 페이지의 주문번호 추출 로직

### 4. 테스트

1. 주문대기 상세 페이지에서 상품 매칭 테스트
2. 주문 처리 테스트
3. 실제 웹사이트에서 주문이 정상적으로 처리되는지 확인

**주의**: MCP 도구를 사용하려면 Cursor의 MCP 서버가 실행 중이어야 합니다.

## 사용 방법

### 상품 매칭

1. 주문대기 상세 페이지 접속
2. 상품 매칭 버튼 클릭
3. "웹사이트에서 상품 검색" 버튼 클릭
4. 브라우저가 자동으로 열리고 상품을 검색합니다
5. 검색 결과를 확인하고 매칭할 상품 선택

### 주문 처리

1. 주문대기 상세 페이지에서 주문할 상품 선택
2. "주문 처리" 버튼 클릭
3. 브라우저가 자동으로 열리고 주문을 처리합니다
4. 주문 완료 후 주문번호가 자동으로 저장됩니다

## 문제 해결

### MCP 도구를 찾을 수 없는 경우

1. Cursor의 MCP 설정을 확인하세요
2. Playwright MCP 서버가 설정되어 있는지 확인하세요
3. MCP 서버가 실행 중인지 확인하세요

### 브라우저가 열리지 않는 경우

1. MCP 서버 로그를 확인하세요
2. Playwright 브라우저가 설치되어 있는지 확인: `npx playwright install chromium`
3. 브라우저 경로가 올바른지 확인하세요

### 셀렉터 오류

1. 실제 웹사이트의 HTML 구조를 확인
2. 브라우저 개발자 도구로 셀렉터 확인
3. `src/utils/playwrightOrderHandler.js`의 셀렉터 수정

## 다음 작업

1. ✅ MCP 도구 설정 확인
2. ⏳ 실제 웹사이트 셀렉터 수정 (`src/utils/playwrightOrderHandler.js`)
3. ⏳ 로그인 처리 로직 구현
4. ⏳ 주문 처리 테스트

## 중요 사항

- **백엔드 서버 불필요**: 별도의 백엔드 서버를 실행할 필요가 없습니다.
- **MCP 도구 사용**: Cursor의 MCP 서버를 통해 Playwright를 실행합니다.
- **셀렉터 수정**: 실제 웹사이트 구조에 맞게 `src/utils/playwrightOrderHandler.js`의 셀렉터를 수정해야 합니다.

