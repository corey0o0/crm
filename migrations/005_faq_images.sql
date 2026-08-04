-- FAQ 답변에 첨부할 이미지 URL 목록
-- 실행: Supabase Dashboard → SQL Editor
--
-- 모든 FAQ에 넣는 용도가 아니라, 고객이 직접 눈으로 확인해야 하는 몇몇 항목에만 채운다.
-- (예: "전원이 안 켜져요" → 디스플레이 커넥터 위치 사진)
-- 값 형식: 공개 URL 문자열 배열. 예) ["https://.../a.jpg", "https://.../b.jpg"]
-- 톡톡은 이미지 1장이 말풍선 1개라 답변당 최대 3장까지만 보낸다(코드에서 제한).

ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN faq_items.images IS 'FAQ 답변과 함께 보낼 이미지 공개 URL 배열 (최대 3장 전송)';
