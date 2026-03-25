-- =============================================
-- 기존 parts 테이블 기능 확장 스키마 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

DO $$
BEGIN
  BEGIN
    ALTER TABLE parts ADD COLUMN name_en text;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;

  BEGIN
    ALTER TABLE parts ADD COLUMN cost_price numeric(12, 2) DEFAULT 0;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;

  BEGIN
    ALTER TABLE parts ADD COLUMN agency_price numeric(12, 2) DEFAULT 0;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;

  BEGIN
    ALTER TABLE parts ADD COLUMN special_price numeric(12, 2) DEFAULT 0;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;

  BEGIN
    ALTER TABLE parts ADD COLUMN barcode text UNIQUE;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;

  BEGIN
    ALTER TABLE parts ADD COLUMN memo text;
  EXCEPTION
    WHEN duplicate_column THEN null;
  END;
END $$;

-- 검색을 빠르게 하기 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS parts_barcode_idx ON parts (barcode);
