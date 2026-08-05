import {
  createOrderProcessingLog,
  updateOrderProcessingLog,
  updatePendingOrderStatus,
  updatePendingOrderItemsToOrdered
} from './pendingOrderUtils';

/**
 * 브랜드별 설정
 */
const BRAND_CONFIG = {
  XRB: {
    url: 'https://www.xrider.co.kr',
    selectors: {
      loginButton: 'button[type="submit"]',
      searchInput: 'input[type="search"], input[name="search"]',
      searchButton: 'button[type="submit"], button.search',
      addToCart: 'button.add-to-cart, button[data-action="add-to-cart"]',
      cartButton: '.cart-button, a[href*="cart"]',
      checkoutButton: 'button.checkout, button[data-action="checkout"]',
      orderButton: 'button.order, button[data-action="order"]',
      orderNumber: '.order-number, .order-id'
    }
  },
  NB: {
    url: 'https://www.nearbike.co.kr',
    selectors: {
      loginButton: 'button[type="submit"]',
      searchInput: 'input[type="search"], input[name="search"]',
      searchButton: 'button[type="submit"], button.search',
      addToCart: 'button.add-to-cart, button[data-action="add-to-cart"]',
      cartButton: '.cart-button, a[href*="cart"]',
      checkoutButton: 'button.checkout, button[data-action="checkout"]',
      orderButton: 'button.order, button[data-action="order"]',
      orderNumber: '.order-number, .order-id'
    }
  }
};

/**
 * 웹사이트 상품 검색 (백엔드 API를 통해 Playwright 실행)
 * @param {string} brand - 브랜드 코드 ('XRB' | 'NB')
 * @param {string} partName - 부품명
 * @param {string} partCode - 부품 코드 (선택)
 * @param {string} barcode - 바코드 (선택)
 * @returns {Object} 검색 결과 { success, productId, productName, options, outOfStock }
 */
export const searchProductOnWebsite = async (brand, partName, partCode, barcode) => {
  try {
    const config = BRAND_CONFIG[brand];
    if (!config) {
      throw new Error(`지원하지 않는 브랜드: ${brand}`);
    }

    // 백엔드 API를 통해 Playwright 실행
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/api/orders/search-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        brand,
        partName,
        partCode,
        barcode
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '상품 검색 실패');
    }

    const result = await response.json();
    return result;

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
 * 브라우저 자동화를 통한 주문 처리
 * @param {string} brand - 브랜드 코드 ('XRB' | 'NB')
 * @param {Array} orderItems - 주문 항목 목록 [{ itemId, partName, partCode, quantity, options, matchedProductId }]
 * @param {string} pendingOrderId - 주문대기 ID
 * @returns {Object} 주문 처리 결과 { success, orderId, message }
 */
export const processOrderWithPlaywright = async (brand, orderItems, pendingOrderId) => {
  try {
    const config = BRAND_CONFIG[brand];
    if (!config) {
      throw new Error(`지원하지 않는 브랜드: ${brand}`);
    }

    if (!orderItems || orderItems.length === 0) {
      throw new Error('주문할 상품이 없습니다.');
    }

    // 주문 처리 로그 시작
    const logResult = await createOrderProcessingLog(pendingOrderId, brand, 'processing');
    if (!logResult.success) {
      throw new Error(`주문 처리 로그 생성 실패: ${logResult.message}`);
    }

    const logId = logResult.data.id;

    try {
      // 주문대기 상태를 처리중으로 변경
      await updatePendingOrderStatus(pendingOrderId, 'processing');

      // 백엔드 API를 통해 Playwright 실행하여 주문 처리
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/orders/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand,
          orderItems
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '주문 처리 실패');
      }

      const orderResult = await response.json();
      const orderId = orderResult.orderId;

      // 주문 처리 로그 업데이트 (성공)
      await updateOrderProcessingLog(logId, 'success', orderId);

      // 주문대기 상태를 완료로 변경
      await updatePendingOrderStatus(pendingOrderId, 'completed');

      // 주문대기 상품 상태를 주문완료로 변경
      const itemIds = orderItems.map(item => item.itemId).filter(Boolean);
      if (itemIds.length > 0) {
        await updatePendingOrderItemsToOrdered(itemIds);
      }

      return {
        success: true,
        orderId: orderId,
        message: `주문이 완료되었습니다. 주문번호: ${orderId || '미확인'}`
      };

    } catch (orderError) {
      // 주문 처리 로그 업데이트 (실패)
      await updateOrderProcessingLog(logId, 'failed', null, orderError.message);

      // 주문대기 상태를 실패로 변경
      await updatePendingOrderStatus(pendingOrderId, 'failed');

      throw orderError;
    }

  } catch (err) {
    console.error('주문 처리 중 오류:', err);
    return {
      success: false,
      orderId: null,
      message: err.message
    };
  }
};

/**
 * Playwright 자동화 단계별 실행 함수
 * 실제 구현은 컴포넌트에서 Playwright MCP 도구를 사용하여 처리
 * @param {string} brand - 브랜드 코드
 * @param {Array} orderItems - 주문 항목 목록
 * @param {Function} playwrightTools - Playwright MCP 도구 함수들
 * @returns {Object} 주문 처리 결과
 */
export const executeOrderSteps = async (brand, orderItems, playwrightTools) => {
  try {
    const config = BRAND_CONFIG[brand];
    const { navigate } = playwrightTools;

    // 1. 웹사이트 접속
    await navigate({ url: config.url });

    // 2. 로그인 처리 (미구현 — 로그인 자격증명은 서버 전용으로 별도 관리해야 함)
    // 로그인 페이지로 이동 (필요한 경우)
    // 로그인 폼 입력 및 제출
    // await click({ selector: config.selectors.loginButton });

    // 3. 각 상품 검색 및 장바구니 추가
    for (const item of orderItems) {
      if (item.status === 'out_of_stock') {
        continue; // 품절 상품은 건너뛰기
      }

      // 상품 검색
      // const searchTerm = item.matchedProductName || item.partName;
      // await fill({ selector: config.selectors.searchInput, value: searchTerm });
      // await click({ selector: config.selectors.searchButton });

      // 검색 결과에서 첫 번째 상품 선택
      // 옵션이 있는 경우 옵션 선택
      if (item.options && item.options.length > 0) {
        // 옵션 선택 로직
        // await click({ selector: `select[name="option"]` });
        // await select({ selector: 'select[name="option"]', value: item.options[0] });
      }

      // 장바구니 추가
      // await click({ selector: config.selectors.addToCart });

      // 수량 조정이 필요한 경우
      if (item.quantity > 1) {
        // 수량 입력 로직
        // await fill({ selector: 'input[name="quantity"]', value: item.quantity.toString() });
      }
    }

    // 4. 장바구니로 이동
    // await click({ selector: config.selectors.cartButton });

    // 5. 주문하기 버튼 클릭
    // await click({ selector: config.selectors.checkoutButton });
    // await click({ selector: config.selectors.orderButton });

    // 6. 주문 완료 페이지에서 주문번호 추출
    // const pageText = await getVisibleText();
    // const orderNumberMatch = pageText.match(/주문번호[:\s]*(\d+)/i);
    // const orderId = orderNumberMatch ? orderNumberMatch[1] : null;

    // 실제 구현에서는 위의 주석 처리된 코드를 실제 Playwright MCP 도구 호출로 대체
    return {
      success: true,
      orderId: null,
      message: '주문 처리 완료'
    };

  } catch (err) {
    console.error('주문 단계 실행 중 오류:', err);
    throw err;
  }
};

/**
 * 백엔드 서버 상태 확인
 * @returns {Object} 서버 상태 { success, message }
 */
export const checkBackendServer = async () => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: data.message || '서버가 실행 중입니다.'
      };
    } else {
      return {
        success: false,
        message: '서버가 응답하지 않습니다.'
      };
    }
  } catch (error) {
    console.error('백엔드 서버 확인 중 오류:', error);
    return {
      success: false,
      message: '서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.'
    };
  }
};

/**
 * 재시도 로직
 * @param {Function} orderFunction - 주문 처리 함수
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {number} delay - 재시도 간 지연 시간 (ms)
 * @returns {Object} 주문 처리 결과
 */
export const retryOrderProcessing = async (orderFunction, maxRetries = 3, delay = 1000) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await orderFunction();
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`주문 처리 시도 ${attempt}/${maxRetries} 실패:`, error.message);

      if (attempt < maxRetries) {
        // 지연 후 재시도
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw new Error(`주문 처리 실패 (${maxRetries}회 시도): ${lastError?.message || '알 수 없는 오류'}`);
};

