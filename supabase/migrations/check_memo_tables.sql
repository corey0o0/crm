-- 메모 테이블 존재 여부 확인
-- Supabase Dashboard > SQL Editor에서 실행

-- ============================================
-- 1. 테이블 존재 확인
-- ============================================
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('user_memos', 'shared_memos') THEN '✅ 존재'
    ELSE '❌ 없음'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_memos', 'shared_memos')
ORDER BY table_name;

-- 예상 결과:
-- table_name     | status
-- --------------|--------
-- shared_memos  | ✅ 존재
-- user_memos    | ✅ 존재

-- ============================================
-- 2. 공유 메모 데이터 확인
-- ============================================
SELECT 
  COUNT(*) as total_records,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ 레코드 없음 - 생성 필요'
    WHEN COUNT(*) = 1 THEN '✅ 정상 (1개)'
    ELSE '⚠️ 여러 개 존재 (1개만 있어야 함)'
  END as status
FROM shared_memos;

-- 예상 결과:
-- total_records | status
-- -------------|------------------
-- 1            | ✅ 정상 (1개)

-- ============================================
-- 3. 개인 메모 데이터 확인
-- ============================================
SELECT 
  COUNT(*) as total_users_with_memos,
  COUNT(DISTINCT user_id) as unique_users
FROM user_memos;

-- 예상 결과:
-- total_users_with_memos | unique_users
-- -----------------------|-------------
-- 1                      | 1

-- ============================================
-- 4. RLS 정책 확인
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN tablename = 'shared_memos' AND policyname LIKE '%shared memos%' THEN '✅ 정상'
    WHEN tablename = 'user_memos' AND policyname LIKE '%user memos%' THEN '✅ 정상'
    ELSE '⚠️ 확인 필요'
  END as status
FROM pg_policies
WHERE tablename IN ('user_memos', 'shared_memos')
ORDER BY tablename, policyname;

-- 예상 결과:
-- tablename     | policyname                           | status
-- --------------|--------------------------------------|--------
-- shared_memos  | Anyone can view shared memos         | ✅ 정상
-- shared_memos  | Anyone can update shared memos       | ✅ 정상
-- shared_memos  | Anyone can insert shared memos       | ✅ 정상
-- user_memos    | Users can view own memos             | ✅ 정상
-- user_memos    | Users can update own memos           | ✅ 정상
-- user_memos    | Users can insert own memos           | ✅ 정상

-- ============================================
-- 5. 공유 메모 상세 정보
-- ============================================
SELECT 
  id,
  memo_name_1,
  memo_name_2,
  memo_name_3,
  LENGTH(memo1) as memo1_length,
  LENGTH(memo2) as memo2_length,
  LENGTH(memo3) as memo3_length,
  updated_at,
  created_at
FROM shared_memos;

-- ============================================
-- 🔧 문제 해결
-- ============================================

-- 만약 테이블이 없다면:
-- → create_shared_memos.sql 실행
-- → create_user_memos.sql 실행

-- 만약 공유 메모 레코드가 없다면:
-- INSERT INTO shared_memos (memo1, memo2, memo3)
-- VALUES ('', '', '');

-- 만약 RLS 정책이 없다면:
-- → create_shared_memos.sql 다시 실행
-- → create_user_memos.sql 다시 실행

