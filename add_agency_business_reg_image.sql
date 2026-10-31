-- 거래처 신규등록: 사업자등록증 이미지 저장용 컬럼 추가
-- Supabase SQL Editor에서 실행.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS business_reg_image_url text;
