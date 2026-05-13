import { sendTelegramNotification } from '../lib/telegram';
import { getAppSetting } from '../api/settingsApi';

// 알림 중복 방지: 같은 상품+창고+임계값 조합은 24시간 내 재전송 안 함
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24시간
const CACHE_PREFIX = 'inv_low_stock_';

/**
 * 변경된 상품에 대해서만 재고 부족 알림 체크 및 전송
 * 
 * @param {Object} inventory - 창고별 재고 { warehouseId: { productId: qty } }
 * @param {Array} products - 상품 목록
 * @param {Array} warehouses - 창고 목록
 * @param {Array} changedProductIds - 변경된 상품 ID 목록 (이 상품들만 체크)
 */
export const checkAndSendLowStockAlerts = async (inventory, products, warehouses, changedProductIds = []) => {
  try {
    // 1. 설정 가져오기
    const { data: alertSettings } = await getAppSetting('inventory_alert_settings');
    if (!alertSettings || !alertSettings.enabled) return;

    const thresholds = (alertSettings.thresholds || [10, 5, 0])
      .map(Number)
      .sort((a, b) => a - b); // 오름차순: [0, 5, 10] — 가장 낮은(긴급한) 임계값부터 매칭

    // 변경된 상품만 필터 (없으면 체크 안 함)
    const changedSet = new Set(changedProductIds.map(id => parseInt(id, 10)));
    if (changedSet.size === 0) return;

    const targetProducts = products.filter(p => changedSet.has(p.id));
    if (targetProducts.length === 0) return;

    // 2. 해당 상품의 재고 부족 여부 체크
    for (const warehouse of warehouses) {
      const whInventory = inventory[warehouse.id] || {};

      for (const product of targetProducts) {
        if (product.track_inventory === false) continue;

        const qty = whInventory[product.id] ?? 0;

        // 가장 가까운(높은) 임계값 1개만 알림
        for (const threshold of thresholds) {
          if (qty <= threshold) {
            const cacheKey = `${CACHE_PREFIX}${warehouse.id}_${product.id}_${threshold}`;
            const lastAlerted = localStorage.getItem(cacheKey);

            // 24시간 내 이미 같은 알림을 보낸 경우 건너뛰기
            if (lastAlerted && (Date.now() - parseInt(lastAlerted, 10)) < ALERT_COOLDOWN_MS) {
              break;
            }

            // 개별 상품 메시지 전송
            const emoji = threshold === 0 ? '🔴' : threshold <= 5 ? '🟠' : '🟡';
            const codeStr = product.code ? ` (${product.code})` : '';
            const message = `${emoji} <b>재고 ${threshold}개 이하 주의</b>\n${product.name}${codeStr} — ${warehouse.name}: <b>${qty}개</b>`;

            const result = await sendTelegramNotification(
              { message },
              { eventType: 'stock_low_alert' }
            );

            if (result.success && !result.bypassed) {
              localStorage.setItem(cacheKey, Date.now().toString());
              console.log(`[InventoryAlert] 알림 전송: ${product.name} (${warehouse.name}) ${qty}개`);
            }

            break; // 가장 가까운 임계값 1개만
          }
        }
      }
    }
  } catch (error) {
    console.error('[InventoryAlert] 재고 부족 알림 처리 실패:', error);
  }
};

/**
 * 특정 상품/창고의 알림 캐시를 초기화 (재고 보충 시)
 */
export const clearLowStockAlertCache = (warehouseId, productId) => {
  const thresholds = [0, 5, 10, 15, 20, 30, 50];
  thresholds.forEach(t => {
    localStorage.removeItem(`${CACHE_PREFIX}${warehouseId}_${productId}_${t}`);
  });
};
