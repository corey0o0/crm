-- 파츠 재고 연동 관계 테이블 생성
CREATE TABLE IF NOT EXISTS public.part_sync_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id_1 INTEGER NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  part_id_2 INTEGER NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_different_parts CHECK (part_id_1 != part_id_2),
  CONSTRAINT unique_sync_relation UNIQUE (part_id_1, part_id_2)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_part_sync_relations_part_id_1 ON public.part_sync_relations(part_id_1);
CREATE INDEX IF NOT EXISTS idx_part_sync_relations_part_id_2 ON public.part_sync_relations(part_id_2);

-- RLS 활성화
ALTER TABLE public.part_sync_relations ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 정책 설정
CREATE POLICY "Allow public read access"
ON public.part_sync_relations FOR SELECT
USING (true);

-- 인증된 사용자가 연동 관계를 관리할 수 있도록 정책 설정
CREATE POLICY "Allow authenticated users to insert"
ON public.part_sync_relations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update"
ON public.part_sync_relations FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete"
ON public.part_sync_relations FOR DELETE
USING (auth.role() = 'authenticated');

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_part_sync_relations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_part_sync_relations_updated_at
  BEFORE UPDATE ON public.part_sync_relations
  FOR EACH ROW
  EXECUTE FUNCTION update_part_sync_relations_updated_at();

-- 테이블 코멘트
COMMENT ON TABLE public.part_sync_relations IS '파츠 간 재고 연동 관계 테이블';
COMMENT ON COLUMN public.part_sync_relations.part_id_1 IS '첫 번째 파츠 ID';
COMMENT ON COLUMN public.part_sync_relations.part_id_2 IS '두 번째 파츠 ID';

