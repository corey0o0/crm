-- =============================================
-- purchase_orders 테이블에 메모 이미지 URL 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

DO $$
BEGIN
  BEGIN
    ALTER TABLE purchase_orders ADD COLUMN memo_image_url text;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;
END $$;
