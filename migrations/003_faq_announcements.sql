-- FAQ 항목을 공지사항으로도 쓸 수 있게 컬럼 추가
-- 일반 FAQ는 is_announcement=false, start_date/end_date NULL 유지 (기존 동작 영향 없음)
ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;
