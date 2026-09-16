export const SHARED_STOCK_MALL_IDS = ['slimpack79', 'nearbike'];

export function isComparableProduct(product) {
  if (product.note === '공임') return false;
  if (product.track_inventory === false) return false;
  return true;
}

export function calculateSharedMallStock(cafe24Data, totalCrmStock) {
  let stock = 0;
  let hasMissing = false;
  let hasDisabled = false;

  SHARED_STOCK_MALL_IDS.forEach((mallId) => {
    const mallData = cafe24Data?.[mallId];
    if (!mallData || mallData.status === '미연동' || mallData.status === '바코드 없음') {
      hasMissing = true;
      return;
    }
    if (!mallData.use_inventory) {
      hasDisabled = true;
      return;
    }
    stock += Number(mallData.stock) || 0;
  });

  const diff = stock - totalCrmStock;
  const isMatch = diff === 0 && !hasMissing && !hasDisabled;
  let status = isMatch ? '합산 일치' : '합산 불일치';
  if (hasMissing) status = '미연동 (합산)';
  else if (hasDisabled) status = '재고 미사용 (합산)';

  return { stock, diff, isMatch, status };
}
