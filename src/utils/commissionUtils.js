export function classifyPaymentChannel(paymentMethod) {
  const method = paymentMethod || '';
  if (method.includes('토스')) return 'toss';
  if (method.includes('네이버')) return 'naver';
  if (method.includes('PG')) return 'toss'; // 카드/가상계좌 등 실제 PG 결제만 토스 수수료율
  return 'other'; // 무통장입금 등 PG 미개입 결제는 수수료 없음
}

export function applyCommission(amount, ratePercent) {
  const fee = Math.round(amount * (ratePercent / 100));
  return { fee, net: amount - fee };
}

export function applyVat(amount, vatIncluded) {
  if (vatIncluded) return amount;
  return Math.round(amount / 1.1);
}
