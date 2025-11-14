/**
 * Playwright MCP 도구를 사용한 주문 처리 핸들러
 * 이 파일은 Playwright MCP 도구를 사용하여 실제 웹사이트에서 주문을 처리합니다.
 * 
 * 사용 방법:
 * 1. 컴포넌트에서 이 함수들을 호출할 때 Playwright MCP 도구를 전달합니다.
 * 2. 또는 백엔드 API를 통해 Playwright를 실행합니다.
 */

/**
 * 웹사이트 상품 검색 (Playwright MCP 사용)
 * @param {Object} playwrightTools - Playwright MCP 도구 객체 { navigate, fill, click, getVisibleText, screenshot }
 * @param {string} brand - 브랜드 코드 ('XRB' | 'NB')
 * @param {string} partName - 부품명
 * @param {string} partCode - 부품 코드 (선택)
 * @param {string} barcode - 바코드 (선택)
 * @returns {Object} 검색 결과 { success, productId, productName, options, outOfStock, productUrl }
 */
export const searchProductWithPlaywright = async (playwrightTools, brand, partName, partCode, barcode) => {
  try {
    const config = getBrandConfig(brand);
    if (!config) {
      throw new Error(`지원하지 않는 브랜드: ${brand}`);
    }

    const { navigate, fill, click, getVisibleText, getVisibleHtml } = playwrightTools;

    // 1. 웹사이트 접속
    await navigate({ url: config.url, headless: false });

    // 2. 로그인 처리 (필요한 경우)
    // 실제 웹사이트 구조에 맞게 수정 필요
    try {
      // 로그인 페이지로 이동 (필요한 경우)
      // await navigate({ url: `${config.url}/login` });
      
      // 로그인 폼 찾기 및 입력
      // await fill({ selector: 'input[name="id"], input[name="user_id"], input[type="text"]', value: config.loginId });
      // await fill({ selector: 'input[name="password"], input[type="password"]', value: config.password });
      // await click({ selector: config.selectors.loginButton });
      
      // 로그인 완료 대기
      // await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (loginError) {
      console.warn('로그인 처리 중 오류 (무시):', loginError);
      // 로그인이 이미 되어 있거나 필요 없는 경우 계속 진행
    }

    // 3. 상품 검색
    const searchTerm = partCode || barcode || partName;
    
    // 검색 입력 필드 찾기 및 입력
    await fill({ 
      selector: config.selectors.searchInput, 
      value: searchTerm 
    });
    
    // 검색 버튼 클릭 또는 Enter 키 입력
    await click({ selector: config.selectors.searchButton });
    
    // 검색 결과 로딩 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. 검색 결과 확인
    const pageText = await getVisibleText();
    const pageHtml = await getVisibleHtml();

    // 품절 확인
    const outOfStock = pageText.includes('품절') || 
                      pageText.includes('재고없음') || 
                      pageText.includes('out of stock') ||
                      pageHtml.includes('out-of-stock') ||
                      pageHtml.includes('sold-out');

    // 상품 정보 추출 (실제 웹사이트 구조에 맞게 수정 필요)
    // 예시: 첫 번째 검색 결과의 상품명과 ID 추출
    const productNameMatch = pageText.match(new RegExp(partName, 'i'));
    const productName = productNameMatch ? partName : null;

    // 상품 URL 또는 ID 추출 (실제 웹사이트 구조에 맞게 수정)
    const productIdMatch = pageHtml.match(/product[_-]?id["\s:=]+(\d+)/i) ||
                           pageHtml.match(/data[_-]?id["\s:=]+(\d+)/i);
    const productId = productIdMatch ? productIdMatch[1] : null;

    // 옵션 확인 (실제 웹사이트 구조에 맞게 수정)
    const optionsMatch = pageHtml.match(/option[_-]?list["\s:]+\[(.*?)\]/i);
    const options = optionsMatch ? optionsMatch[1].split(',').map(opt => opt.trim()) : [];

    return {
      success: true,
      productId: productId,
      productName: productName || partName,
      options: options,
      outOfStock: outOfStock,
      productUrl: null, // 실제 상품 URL 추출 필요
      message: outOfStock ? '상품이 품절되었습니다.' : '상품을 찾았습니다.'
    };

  } catch (err) {
    console.error('웹사이트 상품 검색 중 오류:', err);
    return {
      success: false,
      message: err.message,
      productId: null,
      productName: null,
      options: [],
      outOfStock: false
    };
  }
};

/**
 * 주문 처리 (Playwright MCP 사용)
 * @param {Object} playwrightTools - Playwright MCP 도구 객체
 * @param {string} brand - 브랜드 코드
 * @param {Array} orderItems - 주문 항목 목록
 * @returns {Object} 주문 처리 결과 { success, orderId, message }
 */
export const processOrderWithPlaywrightMCP = async (playwrightTools, brand, orderItems) => {
  try {
    const config = getBrandConfig(brand);
    if (!config) {
      throw new Error(`지원하지 않는 브랜드: ${brand}`);
    }

    if (!orderItems || orderItems.length === 0) {
      throw new Error('주문할 상품이 없습니다.');
    }

    const { navigate, fill, click, getVisibleText, select, screenshot } = playwrightTools;

    // 1. 웹사이트 접속
    await navigate({ url: config.url, headless: false });

    // 2. 로그인 처리
    try {
      // 로그인 페이지로 이동 (필요한 경우)
      // await navigate({ url: `${config.url}/login` });
      
      // 로그인 폼 입력
      // await fill({ selector: 'input[name="id"], input[name="user_id"]', value: config.loginId });
      // await fill({ selector: 'input[name="password"], input[type="password"]', value: config.password });
      // await click({ selector: config.selectors.loginButton });
      
      // 로그인 완료 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
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
      
      await fill({ 
        selector: config.selectors.searchInput, 
        value: searchTerm 
      });
      
      await click({ selector: config.selectors.searchButton });
      
      // 검색 결과 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 검색 결과에서 첫 번째 상품 클릭 (실제 웹사이트 구조에 맞게 수정)
      // await click({ selector: '.product-item:first-child, .product-list-item:first-child' });

      // 옵션이 있는 경우 옵션 선택
      if (item.options && Object.keys(item.options).length > 0) {
        for (const [optionName, optionValue] of Object.entries(item.options)) {
          try {
            await select({ 
              selector: `select[name="${optionName}"], select[data-option="${optionName}"]`, 
              value: optionValue 
            });
          } catch (selectError) {
            console.warn(`옵션 선택 실패 (${optionName}):`, selectError);
          }
        }
      }

      // 수량 조정
      if (item.quantity > 1) {
        try {
          await fill({ 
            selector: 'input[name="quantity"], input[type="number"]', 
            value: item.quantity.toString() 
          });
        } catch (quantityError) {
          console.warn('수량 조정 실패:', quantityError);
        }
      }

      // 장바구니 추가
      await click({ selector: config.selectors.addToCart });
      
      // 장바구니 추가 완료 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 4. 장바구니로 이동
    await click({ selector: config.selectors.cartButton });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. 주문하기 버튼 클릭
    await click({ selector: config.selectors.checkoutButton });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 6. 주문 완료 버튼 클릭
    await click({ selector: config.selectors.orderButton });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 7. 주문 완료 페이지에서 주문번호 추출
    const pageText = await getVisibleText();
    const orderNumberMatch = pageText.match(/주문번호[:\s]*(\d+)/i) ||
                            pageText.match(/주문[_\s]?번호[:\s]*(\d+)/i) ||
                            pageText.match(/order[_\s]?number[:\s]*(\d+)/i) ||
                            pageText.match(/order[_\s]?id[:\s]*(\d+)/i);
    
    const orderId = orderNumberMatch ? orderNumberMatch[1] : null;

    // 스크린샷 저장 (선택사항)
    try {
      await screenshot({ name: `order_${orderId || Date.now()}` });
    } catch (screenshotError) {
      console.warn('스크린샷 저장 실패:', screenshotError);
    }

    return {
      success: true,
      orderId: orderId,
      message: orderId ? `주문이 완료되었습니다. 주문번호: ${orderId}` : '주문이 완료되었습니다. (주문번호 미확인)'
    };

  } catch (err) {
    console.error('주문 처리 중 오류:', err);
    return {
      success: false,
      orderId: null,
      message: `주문 처리 실패: ${err.message}`
    };
  }
};

/**
 * 브랜드별 설정 가져오기
 */
function getBrandConfig(brand) {
  const configs = {
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

  return configs[brand];
}

