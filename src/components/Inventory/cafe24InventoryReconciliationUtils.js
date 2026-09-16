export const SHARED_STOCK_MALL_IDS = ['slimpack79', 'nearbike'];

export function isComparableProduct(product) {
  if (product.note === '공임') return false;
  if (product.track_inventory === false) return false;
  return true;
}

const normalizeDigits = (str) => String(str || '').replace(/[^0-9]/g, '');

// 정확 일치 우선, 없으면 숫자만 남긴 값으로 재비교 (카페24 자체코드에 하이픈 등
// 포맷 문자가 섞여 CRM 바코드와 완전일치하지 않는 경우 대비)
export function findMatchedVariant(variants, barcode) {
  if (!barcode) return null;
  const exact = (variants || []).find(v => v.custom_variant_code && v.custom_variant_code.trim() === barcode);
  if (exact) return exact;

  const barcodeDigits = normalizeDigits(barcode);
  if (!barcodeDigits) return null;
  return (variants || []).find(v => v.custom_variant_code && normalizeDigits(v.custom_variant_code) === barcodeDigits) || null;
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
