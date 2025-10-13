-- 역할 테이블
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 메뉴 권한 테이블 (역할별 허용 메뉴)
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  menu_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, menu_key)
);

-- 사용자 역할 테이블
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- 기본 역할 데이터 삽입
INSERT INTO roles (name, description) VALUES
  ('관리자', '모든 메뉴 접근 가능'),
  ('매니저', '대부분의 메뉴 접근 가능 (설정 제외)'),
  ('일반직원', '기본 메뉴만 접근 가능')
ON CONFLICT (name) DO NOTHING;

-- 관리자 역할에 모든 메뉴 권한 부여
DO $$
DECLARE
  admin_role_id UUID;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = '관리자';
  
  INSERT INTO role_permissions (role_id, menu_key) VALUES
    (admin_role_id, 'dashboard'),
    (admin_role_id, 'customers'),
    (admin_role_id, 'services'),
    (admin_role_id, 'shipment'),
    (admin_role_id, 'parts'),
    (admin_role_id, 'stocks'),
    (admin_role_id, 'inventory_management'),
    (admin_role_id, 'sales_stats'),
    (admin_role_id, 'board'),
    (admin_role_id, 'role_settings')
  ON CONFLICT DO NOTHING;
END $$;

-- 매니저 역할에 대부분의 메뉴 권한 부여 (설정 제외)
DO $$
DECLARE
  manager_role_id UUID;
BEGIN
  SELECT id INTO manager_role_id FROM roles WHERE name = '매니저';
  
  INSERT INTO role_permissions (role_id, menu_key) VALUES
    (manager_role_id, 'dashboard'),
    (manager_role_id, 'customers'),
    (manager_role_id, 'services'),
    (manager_role_id, 'shipment'),
    (manager_role_id, 'parts'),
    (manager_role_id, 'stocks'),
    (manager_role_id, 'inventory_management'),
    (manager_role_id, 'sales_stats'),
    (manager_role_id, 'board')
  ON CONFLICT DO NOTHING;
END $$;

-- 일반직원 역할에 기본 메뉴만 권한 부여
DO $$
DECLARE
  employee_role_id UUID;
BEGIN
  SELECT id INTO employee_role_id FROM roles WHERE name = '일반직원';
  
  INSERT INTO role_permissions (role_id, menu_key) VALUES
    (employee_role_id, 'dashboard'),
    (employee_role_id, 'customers'),
    (employee_role_id, 'services'),
    (employee_role_id, 'board')
  ON CONFLICT DO NOTHING;
END $$;

