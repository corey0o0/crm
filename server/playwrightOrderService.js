/**
 * Playwright를 사용한 주문 처리 서비스
 * 백엔드 서버에서 Playwright를 실행하여 웹사이트에서 주문을 처리합니다.
 */

const { chromium } = require('playwright');

/**
 * 브랜드별 설정
 */
const BRAND_CONFIG = {
  XRB: {
    url: 'https://www.xrider.co.kr',
    loginId: 'xrideras',
    password: 'cjfdls28gh',
    selectors: {
      loginButton: 'button[type="submit"]',
      searchInput: 'input[type="search"], input[name="search"], input[placeholder*="검색"]',
      searchButton: 'button[type="submit"].search, button.search, .search-button',
      addToCart: 'button.add-to-cart, button[data-action="add-to-cart"], .add-cart-btn',
      cartButton: '.cart-button, a[href*="cart"], .cart-link',
      checkoutButton: 'button.checkout, button[data-action="checkout"], .checkout-btn',
      orderButton: 'button.order, button[data-action="order"], .order-btn',
      orderNumber: '.order-number, .order-id, [class*="order-number"]'
    }
  },
  NB: {
    url: 'https://www.nearbike.co.kr',
    loginId: 'xrideras',
    password: 'cjfdls28gh',
    selectors: {
      loginButton: 'button[type="submit"]',
      searchInput: 'input[type="search"], input[name="search"], input[placeholder*="검색"]',
      searchButton: 'button[type="submit"].search, button.search, .search-button',
      addToCart: 'button.add-to-cart, button[data-action="add-to-cart"], .add-cart-btn',
      cartButton: '.cart-button, a[href*="cart"], .cart-link',
      checkoutButton: 'button.checkout, button[data-action="checkout"], .checkout-btn',
      orderButton: 'button.order, button[data-action="order"], .order-btn',
      orderNumber: '.order-number, .order-id, [class*="order-number"]'
    }
  }
};

/**
 * 웹사이트 상품 검색
 * @param {string} brand - 브랜드 코드 ('XRB' | 'NB')
 * @param {string} partName - 부품명
 * @param {string} partCode - 부품 코드 (선택)
 * @param {string} barcode - 바코드 (선택)
 * @returns {Object} 검색 결과
 */
async function searchProductOnWebsite(brand, partName, partCode, barcode) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    const config = BRAND_CONFIG[brand];
    if (!config) {
      throw new Error(`지원하지 않는 브랜드: ${brand}`);
    }

    // 1. 웹사이트 접속
    await page.goto(config.url, { waitUntil: 'networkidle' });

    // 2. 로그인 처리 (필요한 경우)
    try {
      // 로그인 페이지로 이동 (필요한 경우)
      // await page.goto(`${config.url}/login`, { waitUntil: 'networkidle' });
      
      // 로그인 폼 찾기 및 입력
      // await page.fill('input[name="id"], input[name="user_id"], input[type="text"]', config.loginId);
      // await page.fill('input[name="password"], input[type="password"]', config.password);
      // await page.click(config.selectors.loginButton);
      
      // 로그인 완료 대기
      // await page.waitForTimeout(2000);
    } catch (loginError) {
      console.warn('로그인 처리 중 오류 (무시):', loginError);
    }

    // 3. 상품 검색
    const searchTerm = partCode || barcode || partName;
    
    // 검색 입력 필드 찾기 및 입력
    await page.fill(config.selectors.searchInput, searchTerm);
    
    // 검색 버튼 클릭 또는 Enter 키 입력
    await page.click(config.selectors.searchButton);
    // 또는: await page.press(config.selectors.searchInput, 'Enter');
    
    // 검색 결과 로딩 대기
    await page.waitForTimeout(2000);

    // 4. 검색 결과 확인
    const pageText = await page.textContent('body');
    const pageHtml = await page.content();

    // 품절 확인
    const outOfStock = pageText.includes('품절') || 
                      pageText.includes('재고없음') || 
                      pageText.includes('out of stock') ||
                      pageHtml.includes('out-of-stock') ||
                      pageHtml.includes('sold-out');

    // 상품 정보 추출 (실제 웹사이트 구조에 맞게 수정 필요)
    const productNameMatch = pageText.match(new RegExp(partName, 'i'));
    const productName = productNameMatch ? partName : null;

    // 상품 URL 또는 ID 추출 (실제 웹사이트 구조에 맞게 수정)
    const productIdMatch = pageHtml.match(/product[_-]?id["\s:=]+(\d+)/i) ||
                           pageHtml.match(/data[_-]?id["\s:=]+(\d+)/i);
    const productId = productIdMatch ? productIdMatch[1] : null;

    // 옵션 확인 (실제 웹사이트 구조에 맞게 수정)
    const optionsMatch = pageHtml.match(/option[_-]?list["\s:]+\[(.*?)\]/i);
    const options = optionsMatch ? optionsMatch[1].split(',').map(opt => opt.trim()) : [];

    // 스크린샷 저장 (선택사항)
    await page.screenshot({ path: `screenshots/search_${Date.now()}.png` });

    return {
      success: true,
      productId: productId,
      productName: productName || partName,
      options: options,
      outOfStock: outOfStock,
      productUrl: page.url(),
      message: outOfStock ? '상품이 품절되었습니다.' : '상품을 찾았습니다.'
    };

  } catch (error) {
    console.error('웹사이트 상품 검색 중 오류:', error);
    return {
      success: false,
      message: error.message,
      productId: null,
      productName: null,
      options: [],
      outOfStock: false
    };
  } finally {
    await browser.close();
  }
}

/**
 * 주문 처리
 * @param {string} brand - 브랜드 코드
 * @param {Array} orderItems - 주문 항목 목록
 * @returns {Object} 주문 처리 결과
 */
async function processOrderOnWebsite(brand, orderItems) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    const config = BRAND_CONFIG[brand];
    if (!config) {
      throw new Error(`지원하지 않는 브랜드: ${brand}`);
    }

    if (!orderItems || orderItems.length === 0) {
      throw new Error('주문할 상품이 없습니다.');
    }

    // 1. 웹사이트 접속
    await page.goto(config.url, { waitUntil: 'networkidle' });

    // 2. 로그인 처리
    try {
      // 로그인 페이지로 이동 (필요한 경우)
      // await page.goto(`${config.url}/login`, { waitUntil: 'networkidle' });
      
      // 로그인 폼 입력
      // await page.fill('input[name="id"], input[name="user_id"]', config.loginId);
      // await page.fill('input[name="password"], input[type="password"]', config.password);
      // await page.click(config.selectors.loginButton);
      
      // 로그인 완료 대기
      await page.waitForTimeout(2000);
    } catch (loginError) {
      console.warn('로그인 처리 중 오류 (무시):', loginError);
    }

    // 3. 각 상품 검색 및 장바구니 추가
    for (const item of orderItems) {
      if (item.status === 'out_of_stock') {
        console.log(`품절 상품 건너뛰기: ${item.partName}`);
        continue;
      }

      // 상품 검색
      const searchTerm = item.matchedProductName || item.partName;
      
      await page.fill(config.selectors.searchInput, searchTerm);
      await page.click(config.selectors.searchButton);
      
      // 검색 결과 로딩 대기
      await page.waitForTimeout(2000);

      // 검색 결과에서 첫 번째 상품 클릭 (실제 웹사이트 구조에 맞게 수정)
      // await page.click('.product-item:first-child, .product-list-item:first-child');

      // 옵션이 있는 경우 옵션 선택
      if (item.options && Object.keys(item.options).length > 0) {
        for (const [optionName, optionValue] of Object.entries(item.options)) {
          try {
            await page.selectOption(
              `select[name="${optionName}"], select[data-option="${optionName}"]`,
              optionValue
            );
          } catch (selectError) {
            console.warn(`옵션 선택 실패 (${optionName}):`, selectError);
          }
        }
      }

      // 수량 조정
      if (item.quantity > 1) {
        try {
          await page.fill('input[name="quantity"], input[type="number"]', item.quantity.toString());
        } catch (quantityError) {
          console.warn('수량 조정 실패:', quantityError);
        }
      }

      // 장바구니 추가
      await page.click(config.selectors.addToCart);
      
      // 장바구니 추가 완료 대기
      await page.waitForTimeout(1000);
    }

    // 4. 장바구니로 이동
    await page.click(config.selectors.cartButton);
    await page.waitForTimeout(2000);

    // 5. 주문하기 버튼 클릭
    await page.click(config.selectors.checkoutButton);
    await page.waitForTimeout(2000);

    // 6. 주문 완료 버튼 클릭
    await page.click(config.selectors.orderButton);
    await page.waitForTimeout(3000);

    // 7. 주문 완료 페이지에서 주문번호 추출
    const pageText = await page.textContent('body');
    const orderNumberMatch = pageText.match(/주문번호[:\s]*(\d+)/i) ||
                            pageText.match(/주문[_\s]?번호[:\s]*(\d+)/i) ||
                            pageText.match(/order[_\s]?number[:\s]*(\d+)/i) ||
                            pageText.match(/order[_\s]?id[:\s]*(\d+)/i);
    
    const orderId = orderNumberMatch ? orderNumberMatch[1] : null;

    // 스크린샷 저장
    await page.screenshot({ path: `screenshots/order_${orderId || Date.now()}.png` });

    return {
      success: true,
      orderId: orderId,
      message: orderId ? `주문이 완료되었습니다. 주문번호: ${orderId}` : '주문이 완료되었습니다. (주문번호 미확인)'
    };

  } catch (error) {
    console.error('주문 처리 중 오류:', error);
    return {
      success: false,
      orderId: null,
      message: `주문 처리 실패: ${error.message}`
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  searchProductOnWebsite,
  processOrderOnWebsite
};

