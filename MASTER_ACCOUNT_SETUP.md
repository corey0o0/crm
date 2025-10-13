# 마스터 관리자 계정 설정 가이드

## 계정 정보
- **이메일**: master@slimpack.com
- **비밀번호**: Cjfdls28gh!

---

## 설정 순서

### 1단계: 역할 시스템 테이블 생성

먼저 역할 및 권한 관리를 위한 데이터베이스 테이블을 생성합니다.

1. Supabase 대시보드 접속: https://supabase.com/dashboard
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New Query** 클릭
5. 다음 파일의 내용을 복사하여 붙여넣기:
   ```
   supabase/migrations/20250411_create_role_permission_tables.sql
   ```
6. **Run** 버튼 클릭

✅ **확인 방법**: 
- 왼쪽 메뉴의 **Table Editor**에서 `roles`, `role_permissions`, `user_roles` 테이블이 생성되었는지 확인
- `roles` 테이블에 "관리자", "매니저", "일반직원" 3개의 역할이 자동 생성되었는지 확인

---

### 2단계: 마스터 관리자 계정 생성

1. Supabase 대시보드의 **SQL Editor**에서 **New Query** 클릭
2. 다음 파일의 내용을 복사하여 붙여넣기:
   ```
   supabase/migrations/create_master_admin.sql
   ```
3. **Run** 버튼 클릭
4. 하단에 다음과 같은 메시지가 표시되면 성공:
   ```
   새 사용자가 생성되었습니다: master@slimpack.com
   관리자 역할이 할당되었습니다.
   ```

✅ **확인 방법**:
```sql
-- SQL Editor에서 실행하여 확인
SELECT 
  u.email,
  r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'master@slimpack.com';
```

결과에 `master@slimpack.com`과 `관리자` 역할이 표시되어야 합니다.

---

### 3단계: 로그인 테스트

1. 애플리케이션 접속
2. 다음 정보로 로그인:
   - **이메일**: master@slimpack.com
   - **비밀번호**: Cjfdls28gh!

3. 로그인 후 확인 사항:
   - ✅ 모든 메뉴가 표시됨 (대시보드, 고객 관리, A/S 관리, 출고 관리, 파츠 관리, 매장 재고 관리, 입출고 관리, 매출 통계, 게시판, **권한 설정**)
   - ✅ 특히 **권한 설정** 메뉴가 보여야 함 (관리자만 접근 가능)

---

### 4단계: 권한 시스템 테스트

#### 4-1. 다른 사용자에게 역할 할당

1. **권한 설정** 메뉴 클릭
2. **사용자 관리** 버튼 클릭
3. 기존 사용자 목록 확인
4. 사용자에게 역할 할당:
   - **역할 추가** 버튼 클릭
   - 역할 선택 (관리자, 매니저, 일반직원 중 하나)

#### 4-2. 새로운 역할 생성 테스트

1. **권한 설정** 페이지에서 **역할 추가** 버튼 클릭
2. 역할 정보 입력:
   - 이름: 예) "재고 담당자"
   - 설명: 예) "재고 관련 메뉴만 접근 가능"
3. 생성된 역할 카드에서 **권한 설정** 버튼 클릭
4. 원하는 메뉴 권한 체크박스 선택
5. **저장** 버튼 클릭

---

## 문제 해결

### ❌ 1단계에서 에러 발생
**증상**: "relation already exists" 에러
**해결**: 테이블이 이미 존재합니다. 2단계로 진행하세요.

---

### ❌ 2단계에서 "사용자가 이미 존재합니다" 메시지
**해결**: 계정이 이미 생성되어 있습니다. 다음 SQL로 관리자 역할이 할당되었는지 확인:
```sql
SELECT 
  u.email,
  r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'master@slimpack.com';
```

역할이 없다면 수동으로 할당:
```sql
-- 1. 사용자 ID와 관리자 역할 ID 확인
SELECT id, email FROM auth.users WHERE email = 'master@slimpack.com';
SELECT id, name FROM roles WHERE name = '관리자';

-- 2. 역할 할당 (위에서 확인한 ID 사용)
INSERT INTO user_roles (user_id, role_id)
VALUES ('사용자_ID', '관리자_역할_ID');
```

---

### ❌ 로그인 실패
**증상**: "Invalid login credentials" 에러
**해결**:
1. 이메일과 비밀번호를 정확히 입력했는지 확인
2. Supabase에서 사용자 확인:
   ```sql
   SELECT email, email_confirmed_at FROM auth.users 
   WHERE email = 'master@slimpack.com';
   ```
3. `email_confirmed_at`이 NULL이면 인증 필요. 다음 SQL로 인증 처리:
   ```sql
   UPDATE auth.users 
   SET email_confirmed_at = NOW() 
   WHERE email = 'master@slimpack.com';
   ```

---

### ❌ 권한 설정 메뉴가 보이지 않음
**증상**: 로그인은 되지만 "권한 설정" 메뉴가 표시되지 않음
**해결**: 관리자 역할이 제대로 할당되지 않았습니다.
```sql
-- 관리자 역할 재할당
DELETE FROM user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'master@slimpack.com');

INSERT INTO user_roles (user_id, role_id)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'master@slimpack.com'),
  (SELECT id FROM roles WHERE name = '관리자');
```

로그아웃 후 다시 로그인하세요.

---

### ❌ 모든 메뉴가 보임 (권한 필터링이 안 됨)
**증상**: 모든 사용자가 모든 메뉴를 볼 수 있음
**원인**: 사용자에게 역할이 할당되지 않은 경우 (하위 호환성)
**해결**: 사용자에게 적절한 역할을 할당하면 권한 필터링이 활성화됩니다.

---

## 보안 권장사항

### 1. 비밀번호 변경
첫 로그인 후 비밀번호를 변경하는 것을 권장합니다.

Supabase Dashboard > Authentication > Users에서:
1. master@slimpack.com 사용자 찾기
2. 오른쪽 메뉴(...)에서 **Reset Password** 선택

### 2. RLS (Row Level Security) 설정
데이터베이스 보안 강화를 위해 RLS 정책을 설정하세요:

```sql
-- roles 테이블 RLS 활성화
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 조회 가능
CREATE POLICY "Anyone can view roles"
  ON roles FOR SELECT
  USING (auth.role() = 'authenticated');

-- role_permissions 테이블 RLS 활성화
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view role_permissions"
  ON role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- user_roles 테이블 RLS 활성화
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE r.name = '관리자'
  ));
```

### 3. 추가 관리자 계정 생성
마스터 계정 외에 백업용 관리자 계정을 생성하는 것을 권장합니다.

---

## 다음 단계

✅ 마스터 계정 설정 완료 후:
1. 기존 사용자들에게 역할 할당
2. 필요시 추가 역할 생성 (예: 매장 관리자, 회계 담당자 등)
3. 각 역할별 메뉴 권한 세부 조정
4. 팀원들에게 권한 시스템 사용 방법 안내

---

## 문의
설정 중 문제가 발생하면 다음 정보와 함께 문의하세요:
- 진행한 단계
- 발생한 오류 메시지
- Supabase 프로젝트 설정 확인 결과

