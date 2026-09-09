-- 네이버 톡톡 고객 ID 기준 채팅 로그 정리
-- 기존 naver:<user> session_id 로그는 naver_user_id 로 되살릴 수 있다.

ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS naver_user_id text;

UPDATE public.chat_logs
SET naver_user_id = substring(session_id from 7)
WHERE naver_user_id IS NULL
  AND session_id LIKE 'naver:%';

CREATE INDEX IF NOT EXISTS chat_logs_naver_user_id_created_at_idx
  ON public.chat_logs (naver_user_id, created_at DESC);
