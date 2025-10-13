-- 사용자의 역할 제거 스크립트
-- 
-- 사용 방법:
-- 1. 아래 user_email과 role_name을 원하는 값으로 변경
-- 2. Supabase Dashboard > SQL Editor에서 실행

-- ============================================
-- 설정: 여기를 수정하세요
-- ============================================
DO $$
DECLARE
  user_email TEXT := 'user@example.com';  -- 역할을 제거할 사용자 이메일
  role_name TEXT := '일반직원';            -- 제거할 역할 이름 (관리자, 매니저, 일반직원)
  v_user_id UUID;
  v_role_id UUID;
  v_deleted_count INT;
BEGIN
  -- 1. 사용자 ID 가져오기
  SELECT id INTO v_user_id FROM auth.users WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다: %', user_email;
  ELSE
    RAISE NOTICE '✓ 사용자를 찾았습니다: %', user_email;
  END IF;

  -- 2. 역할 ID 가져오기
  SELECT id INTO v_role_id FROM roles WHERE name = role_name;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION '역할을 찾을 수 없습니다: %', role_name;
  ELSE
    RAISE NOTICE '✓ 역할을 찾았습니다: %', role_name;
  END IF;

  -- 3. 사용자의 역할 제거
  DELETE FROM user_roles 
  WHERE user_id = v_user_id AND role_id = v_role_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE '========================================';
  IF v_deleted_count > 0 THEN
    RAISE NOTICE '✅ 역할이 제거되었습니다!';
  ELSE
    RAISE NOTICE '⚠️  해당 사용자에게 이 역할이 할당되어 있지 않습니다.';
  END IF;
  RAISE NOTICE '사용자: %', user_email;
  RAISE NOTICE '역할: %', role_name;
  RAISE NOTICE '========================================';

END $$;

