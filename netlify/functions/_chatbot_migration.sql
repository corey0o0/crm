-- chatbot 사용량 로그 테이블 (rate limiting + 분석용)
-- Supabase SQL Editor에서 한 번 실행

CREATE TABLE IF NOT EXISTS chatbot_logs (
  id        BIGSERIAL PRIMARY KEY,
  ip        TEXT NOT NULL,
  brand     TEXT NOT NULL,
  type      TEXT NOT NULL,  -- 'order' | 'service' | 'chat'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chatbot_logs_ip_type_idx
  ON chatbot_logs (ip, type, created_at DESC);
