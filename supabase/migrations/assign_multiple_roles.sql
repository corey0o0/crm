-- 여러 사용자에게 한 번에 역할 할당 스크립트
-- 
-- 사용 방법:
-- 1. 아래 예시처럼 이메일과 역할을 추가/수정
-- 2. Supabase Dashboard > SQL Editor에서 실행

-- ============================================
-- 예시: 여러 사용자에게 역할 할당
-- ============================================

DO $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
  v_email TEXT;
  v_role_name TEXT;
  assignment RECORD;
BEGIN
  -- 할당할 사용자와 역할 목록
  -- 형식: (이메일, 역할명)
  FOR assignment IN 
    SELECT * FROM (VALUES
      ('user1@example.com', '일반직원'),
      ('user2@example.com', '매니저'),
      ('user3@example.com', '관리자')
      -- 여기에 더 추가하세요
    ) AS t(email, role_name)
  LOOP
    v_email := assignment.email;
    v_role_name := assignment.role_name;
    
    -- 사용자 ID 가져오기
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
      RAISE NOTICE '⚠️  사용자를 찾을 수 없습니다: %', v_email;
      CONTINUE;
    END IF;
    
    -- 역할 ID 가져오기
    SELECT id INTO v_role_id FROM roles WHERE name = v_role_name;
    
    IF v_role_id IS NULL THEN
      RAISE NOTICE '⚠️  역할을 찾을 수 없습니다: %', v_role_name;
      CONTINUE;
    END IF;
    
    -- 역할 할당
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE '✓ % → %', v_email, v_role_name;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 모든 역할 할당이 완료되었습니다!';
  RAISE NOTICE '사용자들은 로그아웃 후 다시 로그인하면 새 권한이 적용됩니다.';
  RAISE NOTICE '========================================';
END $$;

