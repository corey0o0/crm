-- 수기판매 건별 매출 분류 (기체/부품·용품/공임/기타)
-- 상품이나 재고와 분리된 결제 성격 분류 컬럼 (미지정 시 미분류)
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS revenue_category text;

COMMENT ON COLUMN public.shipments.revenue_category IS '수기판매 매출 분류: 기체, 부품·용품, 공임, 기타';
