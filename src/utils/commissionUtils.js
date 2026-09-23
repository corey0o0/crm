export function classifyPaymentChannel(paymentMethod) {
  const method = paymentMethod || '';
  if (method.includes('토스')) return 'toss';
  if (method.includes('네이버')) return 'naver';
  return 'toss'; // 온라인 결제 중 네이버페이 아닌 나머지는 전부 토스 수수료율로 취급
}

export function applyCommission(amount, ratePercent) {
  const fee = Math.round(amount * (ratePercent / 100));
  return { fee, net: amount - fee };
}

export function applyVat(amount, vatIncluded) {
  if (vatIncluded) return amount;
  return Math.round(amount / 1.1);
}
