# 브라우저 자동화 도구 옵션

Playwright 외에 사용할 수 있는 브라우저 자동화 도구들을 정리했습니다.

## 1. Puppeteer

### 개요
- Chrome/Chromium 브라우저를 제어하는 Node.js 라이브러리
- Google에서 개발 및 유지보수
- Chrome DevTools Protocol을 사용

### 장점
- Chrome에 최적화되어 빠른 성능
- 간단한 API
- 스크린샷, PDF 생성 기능 내장
- 널리 사용되어 커뮤니티가 큼

### 단점
- Chrome/Chromium만 지원 (Firefox, Safari 지원 안 함)
- Playwright보다 기능이 제한적

### 설치
```bash
npm install puppeteer
```

### 사용 예시
```javascript
const puppeteer = require('puppeteer');

async function searchProduct(brand, partName) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://www.xrider.co.kr');
  await page.type('input[name="search"]', partName);
  await page.click('button.search');
  
  await page.waitForSelector('.product-item');
  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.product-item')).map(item => ({
      name: item.querySelector('.product-name').textContent,
      price: item.querySelector('.product-price').textContent
    }));
  });
  
  await browser.close();
  return products;
}
```

### MCP 도구
- Puppeteer MCP 서버가 있다면 사용 가능
- 또는 백엔드 API를 통해 사용

---

## 2. Selenium

### 개요
- 가장 오래되고 널리 사용되는 브라우저 자동화 도구
- 다양한 브라우저 지원 (Chrome, Firefox, Safari, Edge 등)
- 다양한 언어 지원 (JavaScript, Python, Java, C# 등)

### 장점
- 가장 널리 사용되어 문서와 예제가 많음
- 다양한 브라우저 지원
- 안정적이고 검증된 도구

### 단점
- 설정이 복잡함 (WebDriver 설치 필요)
- Playwright나 Puppeteer보다 느림
- API가 복잡함

### 설치
```bash
npm install selenium-webdriver
# Chrome WebDriver도 별도로 설치 필요
```

### 사용 예시
```javascript
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function searchProduct(brand, partName) {
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(new chrome.Options().addArguments('--headless'))
    .build();
  
  try {
    await driver.get('https://www.xrider.co.kr');
    await driver.findElement(By.name('search')).sendKeys(partName);
    await driver.findElement(By.css('button.search')).click();
    
    await driver.wait(until.elementLocated(By.css('.product-item')), 10000);
    const products = await driver.findElements(By.css('.product-item'));
    
    const results = [];
    for (const product of products) {
      const name = await product.findElement(By.css('.product-name')).getText();
      const price = await product.findElement(By.css('.product-price')).getText();
      results.push({ name, price });
    }
    
    return results;
  } finally {
    await driver.quit();
  }
}
```

---

## 3. Cypress

### 개요
- 주로 E2E 테스트를 위한 도구
- 브라우저 자동화도 가능하지만 테스트에 최적화됨
- 실시간으로 브라우저에서 실행되는 것을 볼 수 있음

### 장점
- 테스트에 최적화된 API
- 실시간 디버깅 가능
- 자동 대기 기능 (타이밍 이슈 적음)

### 단점
- 주로 테스트 용도로 사용
- 브라우저 자동화보다는 테스트에 특화
- 상대적으로 무거움

### 설치
```bash
npm install cypress
```

### 사용 예시
```javascript
// cypress/integration/order.spec.js
describe('Order Processing', () => {
  it('should search and order product', () => {
    cy.visit('https://www.xrider.co.kr');
    cy.get('input[name="search"]').type('부품명');
    cy.get('button.search').click();
    cy.get('.product-item').first().click();
    cy.get('button.add-to-cart').click();
  });
});
```

---

## 4. Playwright (현재 사용 중)

### 개요
- Microsoft에서 개발
- Chrome, Firefox, Safari 모두 지원
- 빠르고 안정적

### 장점
- 여러 브라우저 지원
- 빠른 성능
- 강력한 API
- 자동 대기 기능
- MCP 도구로 사용 가능

### 단점
- 상대적으로 새로운 도구 (커뮤니티가 Puppeteer보다 작음)

### 네이버 웨일 브라우저 지원

**공식 지원 여부:**
- Playwright는 공식적으로 네이버 웨일을 직접 지원하지 않습니다.
- 공식 지원 브라우저: Chromium, Firefox, WebKit (Safari)

**웨일 브라우저 사용 가능성:**
- 네이버 웨일은 Chromium 기반이므로, Playwright의 Chromium 엔진을 통해 사용할 수 있을 가능성이 있습니다.
- 하지만 완벽한 호환성을 보장하지는 않습니다.

**웨일 브라우저 사용 방법:**
```javascript
const { chromium } = require('playwright');

// 웨일 브라우저 실행 경로 지정
const browser = await chromium.launch({
  headless: false,
  executablePath: '/Applications/Whale.app/Contents/MacOS/Whale' // 웨일 실행 경로
});

const page = await browser.newPage();
await page.goto('https://www.xrider.co.kr');
// ... 나머지 코드
```

**주의사항:**
- 웨일 브라우저의 특정 기능이나 확장 기능을 완벽하게 지원하지 않을 수 있습니다.
- 실제 환경에서 테스트하여 호환성을 확인하는 것이 좋습니다.
- 웨일 브라우저의 실행 경로는 운영체제에 따라 다를 수 있습니다.

---

## 5. Headless Chrome 직접 사용

### 개요
- Chrome DevTools Protocol을 직접 사용
- 가장 낮은 레벨의 제어 가능

### 장점
- 완전한 제어
- 최소한의 의존성

### 단점
- 구현이 복잡함
- 직접 구현해야 함

---

## 6. Cheerio (서버 사이드 HTML 파싱)

### 개요
- 브라우저 자동화가 아닌 HTML 파싱 도구
- 서버 사이드에서 HTML을 파싱하여 데이터 추출

### 장점
- 빠름 (브라우저 실행 불필요)
- 가벼움
- 서버 사이드에서 사용 가능

### 단점
- JavaScript 실행 불가
- 동적 콘텐츠 처리 불가
- 실제 브라우저 자동화가 아님

### 사용 예시
```javascript
const cheerio = require('cheerio');
const axios = require('axios');

async function parseProductPage(url) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const products = [];
  $('.product-item').each((i, elem) => {
    products.push({
      name: $(elem).find('.product-name').text(),
      price: $(elem).find('.product-price').text()
    });
  });
  
  return products;
}
```

---

## 추천 사항

### 현재 상황에 가장 적합한 도구

1. **Playwright (현재 사용 중)** ⭐ 추천
   - MCP 도구로 사용 가능
   - 여러 브라우저 지원
   - 빠르고 안정적

2. **Puppeteer**
   - Chrome만 사용해도 된다면 좋은 선택
   - Playwright와 유사한 API
   - 더 많은 예제와 커뮤니티

3. **Selenium**
   - 다양한 브라우저가 필요하다면
   - 가장 안정적이고 검증된 도구

### 선택 기준

- **Chrome만 사용**: Puppeteer
- **여러 브라우저**: Playwright 또는 Selenium
- **MCP 도구 사용**: Playwright (현재 사용 중)
- **가장 안정적**: Selenium
- **가장 빠름**: Puppeteer 또는 Playwright
- **HTML 파싱만 필요**: Cheerio

---

## 구현 예시

각 도구를 사용하여 주문 처리 기능을 구현하는 예시는 `examples/` 디렉토리에 추가할 수 있습니다.

