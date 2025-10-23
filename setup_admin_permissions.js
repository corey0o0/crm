/**
 * 관리자 권한 설정 스크립트
 * 현재 사용자에게 관리자 권한을 부여합니다.
 */

import { supabase } from './src/lib/supabaseClient.js';

async function setupAdminPermissions() {
  try {
    console.log('관리자 권한 설정 시작...');
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('로그인이 필요합니다.');
    }
    
    console.log('현재 사용자:', user.email);
    
    // 1. 관리자 역할 찾기 또는 생성
    let { data: adminRole, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('name', 'admin')
      .single();
    
    if (roleError && roleError.code === 'PGRST116') {
      // 관리자 역할이 없으면 생성
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({
          name: 'admin',
          description: '시스템 관리자',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) throw createError;
      adminRole = newRole;
      console.log('관리자 역할이 생성되었습니다.');
    } else if (roleError) {
      throw roleError;
    }
    
    console.log('관리자 역할 ID:', adminRole.id);
    
    // 2. 모든 권한 목록
    const allPermissions = [
      'dashboard', 'customers', 'services', 'shipment', 'parts', 
      'stocks', 'inventory_management', 'sales_stats', 'board', 
      'role_settings', 'backup_management', 'receipts', 
      'google_drive_test', 'brand_settings'
    ];
    
    // 3. 관리자 역할에 모든 권한 추가
    for (const permission of allPermissions) {
      const { error: permError } = await supabase
        .from('role_permissions')
        .upsert({
          role_id: adminRole.id,
          menu_key: permission,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (permError) {
        console.warn(`권한 ${permission} 추가 실패:`, permError.message);
      }
    }
    
    console.log('관리자 역할에 모든 권한이 추가되었습니다.');
    
    // 4. 현재 사용자를 관리자 역할에 할당
    const { error: assignError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role_id: adminRole.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (assignError) {
      console.warn('사용자 역할 할당 실패:', assignError.message);
    } else {
      console.log('현재 사용자가 관리자 역할에 할당되었습니다.');
    }
    
    console.log('✅ 관리자 권한 설정이 완료되었습니다!');
    console.log('페이지를 새로고침하면 백업 관리 메뉴가 표시됩니다.');
    
  } catch (error) {
    console.error('❌ 관리자 권한 설정 실패:', error);
  }
}

// 스크립트 실행
setupAdminPermissions();
