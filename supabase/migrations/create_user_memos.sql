-- ============================================
-- 개인 메모 테이블 생성
-- ============================================
-- 각 사용자별 개인 메모를 저장하는 테이블

CREATE TABLE IF NOT EXISTS user_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 메모 내용 (3개)
  memo1 TEXT DEFAULT '',
  memo2 TEXT DEFAULT '',
  memo3 TEXT DEFAULT '',
  
  -- 메모 이름 (3개)
  memo_name_1 TEXT DEFAULT '개인 메모 1',
  memo_name_2 TEXT DEFAULT '개인 메모 2',
  memo_name_3 TEXT DEFAULT '개인 메모 3',
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 사용자당 하나의 레코드만 허용
  UNIQUE(user_id)
);

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================
-- 자신의 메모만 조회/수정 가능

-- RLS 활성화
ALTER TABLE user_memos ENABLE ROW LEVEL SECURITY;

-- 자신의 메모만 조회 가능
CREATE POLICY "Users can view their own memos"
  ON user_memos
  FOR SELECT
  USING (auth.uid() = user_id);

-- 자신의 메모만 삽입 가능
CREATE POLICY "Users can insert their own memos"
  ON user_memos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 자신의 메모만 업데이트 가능
CREATE POLICY "Users can update their own memos"
  ON user_memos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 자신의 메모만 삭제 가능
CREATE POLICY "Users can delete their own memos"
  ON user_memos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 인덱스
-- ============================================
-- 빠른 조회를 위한 인덱스

CREATE INDEX IF NOT EXISTS idx_user_memos_user_id ON user_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memos_updated_at ON user_memos(updated_at DESC);

-- ============================================
-- 자동 updated_at 업데이트 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_user_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_memos_updated_at
  BEFORE UPDATE ON user_memos
  FOR EACH ROW
  EXECUTE FUNCTION update_user_memos_updated_at();

-- ============================================
-- 설명
-- ============================================
COMMENT ON TABLE user_memos IS '사용자별 개인 메모 테이블 (각 사용자마다 3개의 메모 저장)';
COMMENT ON COLUMN user_memos.user_id IS '메모 소유자 (auth.users 참조)';
COMMENT ON COLUMN user_memos.memo1 IS '첫 번째 개인 메모 내용';
COMMENT ON COLUMN user_memos.memo2 IS '두 번째 개인 메모 내용';
COMMENT ON COLUMN user_memos.memo3 IS '세 번째 개인 메모 내용';
COMMENT ON COLUMN user_memos.memo_name_1 IS '첫 번째 메모 이름';
COMMENT ON COLUMN user_memos.memo_name_2 IS '두 번째 메모 이름';
COMMENT ON COLUMN user_memos.memo_name_3 IS '세 번째 메모 이름';

