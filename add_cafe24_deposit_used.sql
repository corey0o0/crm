-- 온라인 주문관리: 예치금 실사용액 별도 저장 컬럼 추가
-- 배경: 예치금은 '정상 판매'로 처리되어 total_amount에 포함되므로,
--       기존엔 실제 예치금 사용액이 어디에도 저장되지 않았다.
--       (적립금은 used_points 컬럼에 별도 저장됨 → 화면에 '-금액'으로 표시 가능)
-- 이 컬럼으로 예치금도 적립금처럼 실사용액을 화면에 표시한다.
--
-- NULL = 아직 백필되지 않은 과거 주문(프론트는 total_amount로 폴백)
-- 0    = 예치금 미사용 주문
-- >0   = 실제 예치금 사용액 (혼합결제 시 total_amount 중 예치금 부분)

ALTER TABLE cafe24_orders
  ADD COLUMN IF NOT EXISTS deposit_used numeric;

COMMENT ON COLUMN cafe24_orders.deposit_used IS '예치금 실사용액(원). total_amount에 포함된 예치금 부분. NULL=미백필, 0=미사용.';
