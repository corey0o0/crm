-- 기존 content 컬럼을 memo1, memo2로 변경
ALTER TABLE user_memos
  DROP COLUMN IF EXISTS content,
  ADD COLUMN IF NOT EXISTS memo1 TEXT,
  ADD COLUMN IF NOT EXISTS memo2 TEXT;
