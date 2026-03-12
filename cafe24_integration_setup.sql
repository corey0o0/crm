-- =============================================
-- 카페24 게시판 연동 DB 설정
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 카페24 연동 설정 테이블 생성
CREATE TABLE IF NOT EXISTS cafe24_settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  mall_id text NOT NULL,
  client_id text,
  client_secret_encrypted text,  -- 프론트에서 직접 저장 (설정용)
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  board_no integer DEFAULT 1,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS 설정 (인증된 사용자만 접근)
ALTER TABLE cafe24_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to cafe24_settings"
  ON cafe24_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. board_posts 테이블에 카페24 메타데이터 컬럼 추가
ALTER TABLE board_posts
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS cafe24_article_no integer,
  ADD COLUMN IF NOT EXISTS cafe24_board_no integer,
  ADD COLUMN IF NOT EXISTS cafe24_writer_name text,
  ADD COLUMN IF NOT EXISTS cafe24_writer_email text,
  ADD COLUMN IF NOT EXISTS cafe24_url text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- 중복 방지 인덱스 (같은 카페24 게시글이 중복 저장되지 않도록)
CREATE UNIQUE INDEX IF NOT EXISTS board_posts_cafe24_unique
  ON board_posts (cafe24_board_no, cafe24_article_no)
  WHERE cafe24_article_no IS NOT NULL;

-- 3. updated_at 자동 갱신 트리거 (cafe24_settings)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cafe24_settings_updated_at ON cafe24_settings;
CREATE TRIGGER update_cafe24_settings_updated_at
  BEFORE UPDATE ON cafe24_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 확인 쿼리
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'board_posts' 
ORDER BY ordinal_position;
