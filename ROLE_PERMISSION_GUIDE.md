# 역할 기반 메뉴 권한 시스템 가이드

## 개요
이 시스템은 사용자의 역할에 따라 메뉴 접근 권한을 관리합니다.

## 시스템 구성

### 1. 데이터베이스 테이블

#### roles (역할)
- `id`: 역할 고유 ID
- `name`: 역할 이름
- `description`: 역할 설명

#### role_permissions (역할별 권한)
- `id`: 권한 고유 ID
- `role_id`: 역할 ID (FK)
- `menu_key`: 메뉴 키

#### user_roles (사용자 역할)
- `id`: 고유 ID
- `user_id`: 사용자 ID (FK to auth.users)
- `role_id`: 역할 ID (FK)

### 2. 메뉴 키 목록

```
dashboard          - 대시보드
customers          - 고객 관리
services           - A/S 관리
shipment           - 출고 관리
parts              - 파츠 관리
stocks             - 매장 재고 관리
inventory_management - 입출고 관리
sales_stats        - 매출 통계
board              - 게시판
role_settings      - 권한 설정 (관리자 전용)
```

## 사용 방법

### 1. 데이터베이스 마이그레이션 실행

Supabase 대시보드에서 다음 파일을 실행:
```
supabase/migrations/20250411_create_role_permission_tables.sql
```

또는 Supabase CLI 사용:
```bash
supabase db push
```

### 2. 기본 역할 확인

마이그레이션 후 다음 3가지 기본 역할이 생성됩니다:

1. **관리자**: 모든 메뉴 접근 가능
2. **매니저**: 권한 설정을 제외한 모든 메뉴 접근 가능
3. **일반직원**: 대시보드, 고객 관리, A/S 관리, 게시판만 접근 가능

### 3. 사용자에게 역할 할당

#### 방법 1: 권한 설정 페이지 사용 (권장)
1. 관리자 계정으로 로그인
2. 좌측 메뉴에서 "권한 설정" 클릭
3. "사용자 관리" 버튼 클릭
4. 사용자 목록에서 "역할 추가" 버튼 클릭
5. 역할 ID 또는 이름 입력

#### 방법 2: SQL 직접 실행
```sql
-- 사용자 ID 확인
SELECT id, email FROM auth.users;

-- 역할 ID 확인
SELECT id, name FROM roles;

-- 역할 할당
INSERT INTO user_roles (user_id, role_id)
VALUES ('사용자_UUID', '역할_UUID');
```

### 4. 새로운 역할 생성

1. 권한 설정 페이지에서 "역할 추가" 버튼 클릭
2. 역할 이름과 설명 입력
3. "권한 설정" 버튼을 클릭하여 메뉴 권한 선택
4. 체크박스로 메뉴 권한 활성화/비활성화

### 5. 역할 권한 수정

1. 권한 설정 페이지에서 수정할 역할 찾기
2. "권한 설정" 버튼 클릭
3. 체크박스로 메뉴 권한 변경
4. "저장" 버튼 클릭

## 시스템 동작 방식

### 메뉴 필터링
- 사용자가 로그인하면 해당 사용자의 역할과 권한이 자동으로 로드됩니다.
- 좌측 메뉴는 사용자가 접근 권한이 있는 메뉴만 표시됩니다.

### 라우트 보호
- 모든 페이지는 `PermissionRoute` 컴포넌트로 보호됩니다.
- 사용자가 권한 없는 페이지에 직접 접근 시도하면 403 에러 페이지가 표시됩니다.

### 하위 호환성
- 권한 정보가 없는 사용자(기존 사용자)는 모든 메뉴에 접근 가능합니다.
- 점진적으로 역할을 할당하여 권한 시스템을 도입할 수 있습니다.

## 개발자 가이드

### 새로운 메뉴 추가 시

1. **Layout.jsx에 메뉴 추가**
```javascript
const allMenuItems = [
  // ...
  { 
    text: '새 메뉴', 
    icon: <NewIcon />, 
    path: '/new-menu', 
    key: 'new_menu' 
  }
];
```

2. **App.jsx에 라우트 추가**
```javascript
<Route path="new-menu" element={
  <PermissionRoute requiredPermission="new_menu">
    <NewMenuComponent />
  </PermissionRoute>
} />
```

3. **RoleManagement.jsx에 권한 추가**
```javascript
const AVAILABLE_PERMISSIONS = [
  // ...
  { key: 'new_menu', label: '새 메뉴' }
];
```

4. **역할에 권한 할당**
- 권한 설정 페이지에서 기존 역할에 새 메뉴 권한 추가

### 권한 체크 함수 사용

```javascript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { hasPermission, hasRole } = useAuth();

  // 특정 메뉴 권한 체크
  if (hasPermission('customers')) {
    // 권한이 있는 경우
  }

  // 특정 역할 체크
  if (hasRole('관리자')) {
    // 관리자인 경우
  }
}
```

## 문제 해결

### 메뉴가 보이지 않는 경우
1. 사용자에게 역할이 할당되었는지 확인
2. 해당 역할에 메뉴 권한이 부여되었는지 확인
3. 브라우저 캐시를 지우고 다시 로그인

### 403 에러가 표시되는 경우
- 사용자의 역할과 권한을 확인하고 필요한 권한을 부여

### 모든 메뉴가 보이는 경우
- 사용자에게 아직 역할이 할당되지 않은 경우 (하위 호환성)
- 원하는 역할을 할당하여 권한 제한 활성화

## 보안 참고사항

1. **RLS (Row Level Security) 설정**: Supabase에서 테이블에 대한 RLS 정책을 설정하는 것을 권장합니다.

```sql
-- roles 테이블 RLS 활성화
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 역할을 조회할 수 있도록 허용
CREATE POLICY "Anyone can view roles"
  ON roles FOR SELECT
  USING (auth.role() = 'authenticated');

-- 관리자만 역할을 수정할 수 있도록 제한 (별도 구현 필요)
```

2. **권한 검증**: 클라이언트 측 권한 체크는 UI 개선을 위한 것이며, 서버 측에서도 권한을 검증해야 합니다.

3. **최소 권한 원칙**: 사용자에게 필요한 최소한의 권한만 부여하세요.

## API 레퍼런스

### roleApi.js

- `getRoles()` - 모든 역할 조회
- `createRole(role)` - 새 역할 생성
- `updateRole(id, role)` - 역할 수정
- `deleteRole(id)` - 역할 삭제
- `getRolePermissions(roleId)` - 역할의 권한 조회
- `updateRolePermissions(roleId, menuKeys)` - 역할의 권한 업데이트
- `getUserRoles(userId)` - 사용자의 역할 조회
- `assignUserRole(userId, roleId)` - 사용자에게 역할 할당
- `removeUserRole(userId, roleId)` - 사용자의 역할 제거
- `getUserPermissions(userId)` - 사용자의 모든 권한 조회

### AuthContext

- `user` - 현재 로그인한 사용자
- `userPermissions` - 사용자의 권한 목록
- `userRoles` - 사용자의 역할 목록
- `hasPermission(menuKey)` - 권한 체크 함수
- `hasRole(roleName)` - 역할 체크 함수
- `loadUserPermissions(userId)` - 권한 다시 로드

## 업데이트 이력

- 2025-04-11: 역할 기반 권한 시스템 최초 구현

