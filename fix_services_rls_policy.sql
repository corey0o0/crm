-- services 테이블 RLS 정책 수정
-- Supabase Dashboard > SQL Editor에서 실행

-- 1. 기존 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'services';

-- 2. services 테이블 RLS 활성화 (이미 활성화되어 있을 수 있음)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 3. 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.services;
DROP POLICY IF EXISTS "Allow authenticated users to select" ON public.services;
DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.services;
DROP POLICY IF EXISTS "Allow authenticated users to update" ON public.services;
DROP POLICY IF EXISTS "Allow authenticated users to delete" ON public.services;

-- 4. 새로운 RLS 정책 생성
-- 인증된 사용자는 모든 작업 가능
CREATE POLICY "Enable all operations for authenticated users" ON public.services
  FOR ALL USING (auth.role() = 'authenticated');

-- 5. 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'services';

-- 6. 테스트 쿼리
SELECT COUNT(*) as total_services FROM public.services;
