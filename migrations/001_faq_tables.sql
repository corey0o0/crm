-- FAQ 관리 테이블
CREATE TABLE IF NOT EXISTS faq_items (
  id           SERIAL PRIMARY KEY,
  brand        TEXT NOT NULL DEFAULT 'SHARED',  -- 'SHARED' | 'NB' | 'XRB'
  label        TEXT NOT NULL,
  keywords     JSONB NOT NULL DEFAULT '[]',
  answer       TEXT NOT NULL,
  category     TEXT DEFAULT '',
  is_active    BOOLEAN DEFAULT true,
  usage_count  INTEGER DEFAULT 0,
  source       TEXT DEFAULT 'manual',           -- 'manual' | 'ai_suggested'
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 채팅 로그 테이블
CREATE TABLE IF NOT EXISTS chat_logs (
  id                 SERIAL PRIMARY KEY,
  session_id         TEXT,
  brand              TEXT NOT NULL DEFAULT 'nb',
  user_message       TEXT NOT NULL,
  bot_reply          TEXT,
  matched_faq_label  TEXT,
  reply_type         TEXT DEFAULT 'llm',  -- 'faq' | 'faq_llm' | 'llm' | 'error'
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE faq_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs  ENABLE ROW LEVEL SECURITY;

-- CRM 인증 사용자 faq_items 전체 접근
CREATE POLICY "auth_faq_items_all" ON faq_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CRM 인증 사용자 chat_logs 읽기 (쓰기는 service key)
CREATE POLICY "auth_chat_logs_read" ON chat_logs
  FOR SELECT TO authenticated USING (true);
