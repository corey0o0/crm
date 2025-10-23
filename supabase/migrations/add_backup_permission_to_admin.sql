-- 관리자 역할에 백업 관리 권한 추가
-- 이 마이그레이션은 기존 관리자 역할에 backup_management 권한을 추가합니다.

-- 1. 관리자 역할 찾기 (name이 'admin' 또는 '관리자'인 역할)
DO $$
DECLARE
    admin_role_id UUID;
BEGIN
    -- 관리자 역할 ID 찾기
    SELECT id INTO admin_role_id 
    FROM roles 
    WHERE name IN ('admin', '관리자', 'Administrator') 
    LIMIT 1;
    
    -- 관리자 역할이 없으면 생성
    IF admin_role_id IS NULL THEN
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('admin', '시스템 관리자', NOW(), NOW())
        RETURNING id INTO admin_role_id;
    END IF;
    
    -- backup_management 권한이 이미 있는지 확인
    IF NOT EXISTS (
        SELECT 1 FROM role_permissions 
        WHERE role_id = admin_role_id AND menu_key = 'backup_management'
    ) THEN
        -- backup_management 권한 추가
        INSERT INTO role_permissions (role_id, menu_key, created_at, updated_at)
        VALUES (admin_role_id, 'backup_management', NOW(), NOW());
        
        RAISE NOTICE '관리자 역할에 백업 관리 권한이 추가되었습니다.';
    ELSE
        RAISE NOTICE '관리자 역할에 이미 백업 관리 권한이 있습니다.';
    END IF;
END $$;

-- 모든 권한을 가진 슈퍼 관리자 역할 생성 (선택사항)
DO $$
DECLARE
    super_admin_role_id UUID;
    permission_key TEXT;
    all_permissions TEXT[] := ARRAY[
        'dashboard', 'customers', 'services', 'shipment', 'parts', 
        'stocks', 'inventory_management', 'sales_stats', 'board', 
        'role_settings', 'backup_management', 'receipts', 
        'google_drive_test', 'brand_settings'
    ];
BEGIN
    -- 슈퍼 관리자 역할이 있는지 확인
    SELECT id INTO super_admin_role_id 
    FROM roles 
    WHERE name = 'super_admin' 
    LIMIT 1;
    
    -- 슈퍼 관리자 역할이 없으면 생성
    IF super_admin_role_id IS NULL THEN
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES ('super_admin', '슈퍼 관리자 - 모든 권한', NOW(), NOW())
        RETURNING id INTO super_admin_role_id;
        
        RAISE NOTICE '슈퍼 관리자 역할이 생성되었습니다.';
    END IF;
    
    -- 모든 권한 추가
    FOREACH permission_key IN ARRAY all_permissions
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM role_permissions 
            WHERE role_id = super_admin_role_id AND menu_key = permission_key
        ) THEN
            INSERT INTO role_permissions (role_id, menu_key, created_at, updated_at)
            VALUES (super_admin_role_id, permission_key, NOW(), NOW());
        END IF;
    END LOOP;
    
    RAISE NOTICE '슈퍼 관리자 역할에 모든 권한이 설정되었습니다.';
END $$;
