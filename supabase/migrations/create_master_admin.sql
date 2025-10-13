-- 마스터 관리자 계정에 역할 할당 스크립트
-- 
-- ⚠️ 중요: 이 스크립트를 실행하기 전에 먼저 Supabase 대시보드에서 계정을 생성하세요!
--
-- 사용 방법:
-- 1. Supabase Dashboard > Authentication > Users로 이동
-- 2. "Add user" > "Create new user" 클릭
-- 3. 이메일: master@slimpack.com, 비밀번호: Cjfdls28gh! 입력
-- 4. "Auto Confirm User" 체크박스 선택
-- 5. 사용자 생성 후, 이 SQL 스크립트를 SQL Editor에서 실행하여 관리자 역할 할당

-- ============================================
-- 설정: 마스터 관리자 계정 정보
-- ============================================
DO $$
DECLARE
  master_email TEXT := 'master@slimpack.com';
  v_user_id UUID;
  v_admin_role_id UUID;
BEGIN
  -- 1. 사용자 ID 가져오기
  SELECT id INTO v_user_id FROM auth.users WHERE email = master_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다: %. Supabase Dashboard에서 먼저 사용자를 생성하세요.', master_email;
  ELSE
    RAISE NOTICE '사용자를 찾았습니다: % (ID: %)', master_email, v_user_id;
  END IF;

  -- 2. 관리자 역할 ID 가져오기
  SELECT id INTO v_admin_role_id FROM roles WHERE name = '관리자';

  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION '관리자 역할을 찾을 수 없습니다. 먼저 20250411_create_role_permission_tables.sql을 실행하세요.';
  ELSE
    RAISE NOTICE '관리자 역할 ID: %', v_admin_role_id;
  END IF;

  -- 3. 사용자에게 관리자 역할 할당
  INSERT INTO user_roles (user_id, role_id)
  VALUES (v_user_id, v_admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RAISE NOTICE '✅ 관리자 역할이 할당되었습니다!';
  RAISE NOTICE '=================================';
  RAISE NOTICE '마스터 계정 정보:';
  RAISE NOTICE '이메일: %', master_email;
  RAISE NOTICE '비밀번호: Cjfdls28gh!';
  RAISE NOTICE '=================================';
  RAISE NOTICE '로그인 후 "권한 설정" 메뉴가 보이는지 확인하세요.';

END $$;

