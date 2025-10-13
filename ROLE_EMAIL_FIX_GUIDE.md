# 역할 관리 이메일 표시 문제 해결 가이드 🔧

## 문제 상황
- ❌ 사용자 목록에서 이메일 대신 ID만 표시됨 (`사용자 e387e888...`)
- ❌ 새 사용자에게 역할 할당 시 이메일로 추가가 안 됨

## 원인
Supabase RPC 함수가 `auth.users` 테이블에 접근할 권한이 부족했습니다.

---

## ✅ 해결 방법

### 1단계: 업데이트된 RPC 함수 재실행

**Supabase Dashboard > SQL Editor**에서 다음 파일을 **다시 실행**하세요:
```
supabase/migrations/create_role_helper_functions.sql
```

이 업데이트는 다음을 개선합니다:
- ✅ `SECURITY DEFINER` + `SET search_path` 추가
- ✅ 함수 소유자를 `postgres`로 변경
- ✅ auth.users 테이블 접근 권한 강화

### 2단계: 브라우저 새로고침

업데이트 후 권한 설정 페이지를 새로고침하세요.

### 3단계: 확인

1. **권한 설정** > **사용자 관리** 클릭
2. 사용자 목록에서 **이메일이 제대로 표시**되는지 확인
3. **새 사용자에게 역할 할당** 버튼으로 테스트

---

## 🔍 변경 내용 상세

### Before (문제 있음)
```sql
CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY DEFINER  -- 권한 부족
AS $$
BEGIN
  SELECT * FROM auth.users ...  -- 접근 실패
END;
$$;
```

### After (수정됨)
```sql
CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth  -- 스키마 명시
AS $$
BEGIN
  SELECT * FROM auth.users ...  -- 정상 접근
END;
$$;

ALTER FUNCTION get_all_users_with_roles() OWNER TO postgres;  -- 소유자 변경
```

---

## 🧪 테스트 방법

### 1. SQL Editor에서 직접 테스트
```sql
-- 1. 사용자 목록 조회 테스트
SELECT * FROM get_all_users_with_roles();

-- 예상 결과:
-- user_id                              | email                | roles
-- -------------------------------------|----------------------|-------
-- abc123...                            | master@slimpack.com  | [{"id":"...","name":"관리자"}]
```

### 2. 이메일로 역할 할당 테스트
```sql
-- 2. 이메일로 역할 할당 테스트
SELECT assign_role_by_email('user@example.com', '일반직원');

-- 예상 결과:
-- {"success": true, "message": "user@example.com에게 역할이 할당되었습니다"}
```

---

## ⚠️ 문제가 계속되는 경우

### 방법 1: 함수 재생성

모든 함수를 삭제하고 다시 생성:

```sql
-- 1. 기존 함수 삭제
DROP FUNCTION IF EXISTS get_user_id_by_email(TEXT);
DROP FUNCTION IF EXISTS get_user_email(UUID);
DROP FUNCTION IF EXISTS assign_role_by_email(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_all_users_with_roles();

-- 2. create_role_helper_functions.sql 다시 실행
```

### 방법 2: 수동 권한 부여

```sql
-- auth.users 테이블에 대한 읽기 권한 부여
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT SELECT ON auth.users TO postgres;

-- 함수 재실행
```

### 방법 3: Supabase 프로젝트 설정 확인

1. Supabase Dashboard > Settings > Database
2. **Connection pooling** 확인
3. **Enable pooler mode** 확인

---

## 📊 확인 체크리스트

실행 전:
- [ ] `create_role_helper_functions.sql` 파일이 업데이트되었는지 확인
- [ ] Supabase Dashboard에 로그인

실행 후:
- [ ] SQL Editor에서 에러 없이 실행 완료
- [ ] `get_all_users_with_roles()` 함수 테스트 성공
- [ ] 권한 설정 페이지에서 이메일 정상 표시
- [ ] 새 사용자 역할 할당 기능 정상 작동

---

## 🎯 예상 결과

### Before (문제 상황)
```
사용자: 사용자 e387e888...
ID: e387e888...
할당된 역할: 관리자 ✕
```

### After (수정 완료)
```
사용자: master@slimpack.com
ID: e387e888...
할당된 역할: 관리자 ✕
```

---

## 🔐 보안 참고사항

### SECURITY DEFINER란?
- 함수가 **생성자의 권한**으로 실행됩니다
- `postgres` 사용자 권한으로 실행되어 `auth.users` 접근 가능
- 안전하게 설계되어 있어 보안 문제 없음

### SET search_path란?
- SQL 함수가 참조하는 **스키마 순서**를 명시
- `public, auth` = public 스키마 먼저, 그 다음 auth 스키마
- 테이블 이름 충돌 방지 및 명확한 참조

---

## 💡 추가 팁

### 이메일로 빠른 역할 할당
웹 UI 대신 SQL로 빠르게 할당:
```sql
-- 여러 사용자에게 한 번에 역할 할당
SELECT assign_role_by_email('user1@example.com', '일반직원');
SELECT assign_role_by_email('user2@example.com', '매니저');
SELECT assign_role_by_email('user3@example.com', '관리자');
```

### 현재 권한 상태 확인
```sql
-- 모든 사용자와 역할 확인
SELECT 
  u.email,
  r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
ORDER BY u.email;
```

---

## 📞 지원

문제가 계속되면 다음 정보와 함께 문의하세요:
- Supabase 프로젝트 ID
- SQL 실행 결과 (에러 메시지 포함)
- 브라우저 콘솔 로그 (F12 → Console)
- 스크린샷

---

## ✅ 최종 확인

수정 완료 후 다음을 확인하세요:

1. ✅ SQL 파일 실행 성공
2. ✅ 함수 테스트 성공
3. ✅ 웹 UI에서 이메일 표시
4. ✅ 역할 할당 기능 정상 작동
5. ✅ 팀원들에게 사용법 안내

모두 확인되었다면 문제가 해결되었습니다! 🎉

