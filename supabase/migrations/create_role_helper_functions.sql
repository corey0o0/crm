-- 역할 관리를 위한 헬퍼 함수들
-- 
-- 사용 방법:
-- Supabase Dashboard > SQL Editor에서 이 파일 실행

-- ============================================
-- 이메일로 사용자 ID 찾기
-- ============================================
CREATE OR REPLACE FUNCTION get_user_id_by_email(email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE auth.users.email = get_user_id_by_email.email
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

-- 함수 소유자 변경
ALTER FUNCTION get_user_id_by_email(TEXT) OWNER TO postgres;

-- ============================================
-- 사용자 ID로 이메일 찾기
-- ============================================
CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email::TEXT INTO v_email
  FROM auth.users
  WHERE id = user_id
  LIMIT 1;
  
  RETURN v_email;
END;
$$;

-- 함수 소유자 변경
ALTER FUNCTION get_user_email(UUID) OWNER TO postgres;

-- ============================================
-- 이메일로 역할 할당 (올인원 함수)
-- ============================================
CREATE OR REPLACE FUNCTION assign_role_by_email(
  user_email TEXT,
  role_name_or_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
  v_result JSON;
BEGIN
  -- 1. 이메일로 사용자 ID 찾기
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', '해당 이메일의 사용자를 찾을 수 없습니다: ' || user_email
    );
  END IF;
  
  -- 2. 역할 ID 찾기 (이름 또는 ID로)
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE name = role_name_or_id OR id::text = role_name_or_id
  LIMIT 1;
  
  IF v_role_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', '해당 역할을 찾을 수 없습니다: ' || role_name_or_id
    );
  END IF;
  
  -- 3. 역할 할당
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_user_id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'role_id', v_role_id,
    'message', user_email || '에게 역할이 할당되었습니다'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 함수 소유자 변경
ALTER FUNCTION assign_role_by_email(TEXT, TEXT) OWNER TO postgres;

-- ============================================
-- 모든 사용자 목록 (역할 포함) - 개선된 버전
-- ============================================
CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  roles JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.email::TEXT,
    COALESCE(
      json_agg(
        json_build_object(
          'id', r.id,
          'name', r.name,
          'description', r.description
        )
      ) FILTER (WHERE r.id IS NOT NULL),
      '[]'::json
    ) AS roles
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  LEFT JOIN public.roles r ON ur.role_id = r.id
  GROUP BY u.id, u.email
  ORDER BY u.created_at DESC;
END;
$$;

-- 함수 소유자를 postgres로 변경하여 auth 스키마 접근 권한 부여
ALTER FUNCTION get_all_users_with_roles() OWNER TO postgres;

-- 함수들에 대한 권한 설정
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_role_by_email(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_with_roles() TO authenticated;

