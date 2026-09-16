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

// 두 몰 중 하나에만 있는 상품도 많음 - 미연동/바코드없음인 몰은 "원래 없는 몰"로 보고
// 합산에서 제외한다. 실제로 매칭된 몰이 하나도 없을 때만 미연동으로 처리.
export function calculateSharedMallStock(cafe24Data, totalCrmStock) {
  let stock = 0;
  let matchedCount = 0;
  let hasDisabled = false;

  SHARED_STOCK_MALL_IDS.forEach((mallId) => {
    const mallData = cafe24Data?.[mallId];
    if (!mallData || mallData.status === '미연동' || mallData.status === '바코드 없음') {
      return;
    }
    if (!mallData.use_inventory) {
      hasDisabled = true;
      return;
    }
    matchedCount += 1;
    stock += Number(mallData.stock) || 0;
  });

  if (matchedCount === 0) {
    return {
      stock: 0,
      diff: 0 - totalCrmStock,
      isMatch: false,
      status: hasDisabled ? '재고 미사용 (합산)' : '미연동 (합산)',
    };
  }

  const diff = stock - totalCrmStock;
  const isMatch = diff === 0;
  const status = isMatch ? '합산 일치' : '합산 불일치';

  return { stock, diff, isMatch, status };
}
