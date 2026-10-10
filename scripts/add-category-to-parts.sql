-- parts 테이블에 category 컬럼 추가
ALTER TABLE parts ADD COLUMN IF NOT EXISTS category TEXT;

-- 기존 데이터를 '파츠'로 초기화 (NULL 방지)
UPDATE parts SET category = '파츠' WHERE category IS NULL;

-- 이제 migrate-category.sql 실행 가능
