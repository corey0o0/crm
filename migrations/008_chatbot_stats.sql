-- 챗봇 통계용 로그 컬럼
-- FAQ 관리 화면에서 AI 응답률, 응답 속도, 상담원 연결률, 핸드오프 실행률 집계에 사용

ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS response_ms INTEGER;
ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS handoff_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS handoff_executed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS chat_logs_brand_created_at_idx
  ON chat_logs (brand, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_logs_reply_type_created_at_idx
  ON chat_logs (reply_type, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_logs_handoff_created_at_idx
  ON chat_logs (created_at DESC)
  WHERE handoff_requested OR handoff_executed OR reply_type = 'agent';
