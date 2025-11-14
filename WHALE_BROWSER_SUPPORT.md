# Playwright와 네이버 웨일 브라우저

## 공식 지원 여부

Playwright는 **공식적으로 네이버 웨일 브라우저를 직접 지원하지 않습니다.**

### 공식 지원 브라우저
- **Chromium** (Chrome 기반)
- **Firefox**
- **WebKit** (Safari 기반)

## 웨일 브라우저 사용 가능성

네이버 웨일은 **Chromium 기반**으로 개발되었기 때문에, Playwright의 Chromium 엔진을 통해 사용할 수 있을 가능성이 있습니다.

### 사용 방법

#### 1. 웨일 브라우저 실행 경로 지정

```javascript
const { chromium } = require('playwright');

// 웨일 브라우저 실행 경로 지정
const browser = await chromium.launch({
  headless: false,
  executablePath: '/Applications/Whale.app/Contents/MacOS/Whale' // macOS
  // Windows: 'C:\\Program Files\\Whale\\Whale.exe'
  // Linux: '/usr/bin/whale'
});

const page = await browser.newPage();
await page.goto('https://www.xrider.co.kr');
```

#### 2. 환경 변수로 설정

```javascript
// .env 파일
WHALE_BROWSER_PATH=/Applications/Whale.app/Contents/MacOS/Whale

// 코드
const browser = await chromium.launch({
  headless: false,
  executablePath: process.env.WHALE_BROWSER_PATH
});
```

#### 3. 자동 경로 감지

```javascript
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 웨일 브라우저 경로 자동 감지
function findWhalePath() {
  const possiblePaths = [
    // macOS
    '/Applications/Whale.app/Contents/MacOS/Whale',
    // Windows
    'C:\\Program Files\\Whale\\Whale.exe',
    'C:\\Program Files (x86)\\Whale\\Whale.exe',
    // Linux
    '/usr/bin/whale',
    '/usr/local/bin/whale'
  ];

  for (const whalePath of possiblePaths) {
    if (fs.existsSync(whalePath)) {
      return whalePath;
    }
  }
  return null;
}

const whalePath = findWhalePath();
if (whalePath) {
  const browser = await chromium.launch({
    headless: false,
    executablePath: whalePath
  });
} else {
  console.warn('웨일 브라우저를 찾을 수 없습니다. 기본 Chromium을 사용합니다.');
  const browser = await chromium.launch({ headless: false });
}
```

## 주의사항

### 1. 호환성 문제
- 웨일 브라우저의 특정 기능이나 확장 기능을 완벽하게 지원하지 않을 수 있습니다.
- 웨일 브라우저의 고유 기능은 사용할 수 없을 수 있습니다.

### 2. 실행 경로
- 웨일 브라우저의 실행 경로는 운영체제와 설치 위치에 따라 다를 수 있습니다.
- 실제 환경에서 경로를 확인해야 합니다.

### 3. 테스트 필요
- 실제 환경에서 테스트하여 호환성을 확인하는 것이 좋습니다.
- 모든 기능이 정상적으로 작동하는지 확인해야 합니다.

## 대안

### 1. Chromium 사용 (권장)
- 웨일 브라우저 대신 Playwright의 기본 Chromium을 사용하는 것이 가장 안정적입니다.
- 대부분의 경우 Chromium으로도 충분합니다.

```javascript
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: false });
```

### 2. Chrome 사용
- Chrome 브라우저를 직접 사용할 수도 있습니다.

```javascript
const { chromium } = require('playwright');
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome' // Chrome 브라우저 사용
});
```

### 3. Selenium 사용
- Selenium은 웨일 브라우저를 더 잘 지원할 수 있습니다.
- 하지만 설정이 복잡하고 Playwright보다 느립니다.

## 결론

- **공식 지원**: ❌ 없음
- **사용 가능성**: ⚠️ 제한적 (Chromium 엔진을 통한 간접 사용)
- **권장 사항**: ✅ 기본 Chromium 사용 또는 Chrome 사용

웨일 브라우저가 반드시 필요한 경우가 아니라면, Playwright의 기본 Chromium이나 Chrome을 사용하는 것을 권장합니다.

