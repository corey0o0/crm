# 403 에러 해결 가이드 🔧

## 문제
```
Failed to load resource: the server responded with a status of 403 ()
```

이 에러는 **Supabase RPC 함수 실행 권한**이 없어서 발생합니다.

---

## ✅ 해결 방법

### 1단계: Supabase Dashboard 접속

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. **SQL Editor** 클릭

### 2단계: RPC 함수 실행

아래 SQL을 **복사해서 SQL Editor에 붙여넣고 실행**하세요:

```sql
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

ALTER FUNCTION get_user_email(UUID) OWNER TO postgres;

-- ============================================
-- 이메일로 역할 할당
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

ALTER FUNCTION assign_role_by_email(TEXT, TEXT) OWNER TO postgres;

-- ============================================
-- 모든 사용자 목록 조회
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

ALTER FUNCTION get_all_users_with_roles() OWNER TO postgres;

-- ============================================
-- 권한 부여 (가장 중요!)
-- ============================================
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_role_by_email(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_with_roles() TO authenticated;
```

### 3단계: 테스트

SQL Editor에서 아래 쿼리로 테스트:

```sql
-- 사용자 목록이 이메일과 함께 표시되어야 합니다
SELECT * FROM get_all_users_with_roles();
```

**예상 결과**:
```
user_id                              | email                | roles
-------------------------------------|----------------------|-------
e387e888-xxxx-xxxx-xxxx-xxxxxxxxxxxx | master@slimpack.com  | [{"id":"...","name":"관리자"}]
```

### 4단계: 웹 페이지 새로고침

브라우저를 **완전히 새로고침** (Cmd+Shift+R 또는 Ctrl+Shift+R)

---

## 🧪 확인 사항

### ✅ 성공한 경우
- SQL 실행 후 "Success. No rows returned" 메시지
- 테스트 쿼리에서 이메일 표시
- 웹 페이지에서 403 에러 사라짐
- 사용자 목록에 이메일 표시

### ❌ 여전히 에러가 나는 경우

#### 방법 1: 함수 삭제 후 재생성
```sql
-- 모든 함수 삭제
DROP FUNCTION IF EXISTS get_user_id_by_email(TEXT);
DROP FUNCTION IF EXISTS get_user_email(UUID);
DROP FUNCTION IF EXISTS assign_role_by_email(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_all_users_with_roles();

-- 위의 전체 SQL을 다시 실행
```

#### 방법 2: RLS 정책 확인
```sql
-- user_roles 테이블 RLS 확인
SELECT * FROM pg_policies WHERE tablename = 'user_roles';

-- roles 테이블 RLS 확인
SELECT * FROM pg_policies WHERE tablename = 'roles';
```

만약 RLS가 너무 엄격하면:
```sql
-- 읽기 권한 부여 (임시)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read user_roles" ON user_roles FOR SELECT USING (true);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read roles" ON roles FOR SELECT USING (true);
```

---

## 🔍 에러 디버깅

브라우저 콘솔(F12)에서 더 자세한 에러 확인:

```javascript
// 콘솔에서 직접 테스트
const { data, error } = await supabase.rpc('get_all_users_with_roles');
console.log('Data:', data);
console.log('Error:', error);
```

---

## 📋 빠른 체크리스트

- [ ] Supabase Dashboard 접속
- [ ] SQL Editor 열기
- [ ] 전체 SQL 복사/붙여넣기
- [ ] RUN 버튼 클릭
- [ ] "Success" 메시지 확인
- [ ] 테스트 쿼리 실행
- [ ] 이메일 표시 확인
- [ ] 웹 페이지 완전 새로고침 (Cmd+Shift+R)
- [ ] 403 에러 사라짐 확인
- [ ] 사용자 역할 관리 클릭
- [ ] 이메일이 제대로 표시되는지 확인 ✅

---

## ⚡ 완료!

모든 단계를 완료하면:
- ✅ 403 에러 해결
- ✅ 사용자 이메일 표시
- ✅ DOM nesting 경고 해결
- ✅ 역할 할당 기능 정상 작동

문제가 계속되면 브라우저 콘솔의 에러 메시지를 확인하세요!

