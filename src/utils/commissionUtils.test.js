import { classifyPaymentChannel, applyCommission, applyVat } from './commissionUtils';

test('classifyPaymentChannel returns toss for method containing 토스', () => {
  expect(classifyPaymentChannel('토스페이')).toBe('toss');
});

test('classifyPaymentChannel returns naver for method containing 네이버', () => {
  expect(classifyPaymentChannel('네이버페이')).toBe('naver');
});

test('classifyPaymentChannel returns toss for PG 카드결제', () => {
  expect(classifyPaymentChannel('신용카드,PG')).toBe('toss');
});

test('classifyPaymentChannel returns vaccount for 가상계좌 (건별 고정 수수료)', () => {
  expect(classifyPaymentChannel('가상계좌,PG')).toBe('vaccount');
  expect(classifyPaymentChannel('가상계좌')).toBe('vaccount');
});

test('classifyPaymentChannel returns bank_transfer for 계좌이체', () => {
  expect(classifyPaymentChannel('계좌이체')).toBe('bank_transfer');
});

test('classifyPaymentChannel returns other for PG 안 타는 결제(무통장입금 등)', () => {
  expect(classifyPaymentChannel('무통장입금')).toBe('other');
});

test('classifyPaymentChannel returns other for empty/missing method', () => {
  expect(classifyPaymentChannel('')).toBe('other');
  expect(classifyPaymentChannel(undefined)).toBe('other');
});

test('applyCommission computes fee and net from rate percent', () => {
  expect(applyCommission(10000, 3.3)).toEqual({ fee: 330, net: 9670 });
});

test('applyCommission with zero rate returns full amount as net', () => {
  expect(applyCommission(10000, 0)).toEqual({ fee: 0, net: 10000 });
});

test('applyVat returns amount unchanged when included', () => {
  expect(applyVat(11000, true)).toBe(11000);
});

test('applyVat divides by 1.1 and rounds when not included', () => {
  expect(applyVat(11000, false)).toBe(10000);
});
