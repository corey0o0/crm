export function classifyPaymentChannel(paymentMethod) {
  const method = paymentMethod || '';
  if (method.includes('토스')) return 'toss';
  if (method.includes('네이버')) return 'naver';
  return 'other';
}

export function applyCommission(amount, ratePercent) {
  const fee = Math.round(amount * (ratePercent / 100));
  return { fee, net: amount - fee };
}

export function applyVat(amount, vatIncluded) {
  if (vatIncluded) return amount;
  return Math.round(amount / 1.1);
}
