-- 전체 사용자가 공유하는 메모 테이블 생성
-- 
-- 사용 방법:
-- Supabase Dashboard > SQL Editor에서 실행

-- ============================================
-- 공유 메모 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS shared_memos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo1 TEXT,
  memo2 TEXT,
  memo3 TEXT,
  memo_name_1 VARCHAR(100) DEFAULT '메모 1',
  memo_name_2 VARCHAR(100) DEFAULT '메모 2',
  memo_name_3 VARCHAR(100) DEFAULT '메모 3',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 설정 (모든 인증된 사용자가 읽기/쓰기 가능)
ALTER TABLE shared_memos ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모든 공유 메모를 볼 수 있음
CREATE POLICY "Anyone can view shared memos"
  ON shared_memos FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인증된 사용자는 공유 메모를 수정할 수 있음
CREATE POLICY "Anyone can update shared memos"
  ON shared_memos FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자는 공유 메모를 삽입할 수 있음 (초기 데이터 생성용)
CREATE POLICY "Anyone can insert shared memos"
  ON shared_memos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 기본 공유 메모 레코드 생성 (단 하나만 존재)
INSERT INTO shared_memos (memo1, memo2, memo3)
VALUES ('', '', '')
ON CONFLICT DO NOTHING;

-- 공유 메모는 항상 1개만 유지 (제약조건)
-- 추가 레코드 삽입 방지를 위한 트리거
CREATE OR REPLACE FUNCTION prevent_multiple_shared_memos()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM shared_memos) >= 1 THEN
    RAISE EXCEPTION '공유 메모는 하나만 존재할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_shared_memo
BEFORE INSERT ON shared_memos
FOR EACH ROW
EXECUTE FUNCTION prevent_multiple_shared_memos();

-- 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_shared_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_shared_memos_updated_at
BEFORE UPDATE ON shared_memos
FOR EACH ROW
EXECUTE FUNCTION update_shared_memos_updated_at();

COMMENT ON TABLE shared_memos IS '전체 사용자가 공유하는 대시보드 메모';
COMMENT ON COLUMN shared_memos.updated_by IS '마지막으로 수정한 사용자 ID';

