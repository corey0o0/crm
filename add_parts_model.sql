-- =============================================
-- parts 테이블에 기종(model) 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

DO $$
BEGIN
  BEGIN
    ALTER TABLE parts ADD COLUMN model text;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;
END $$;
