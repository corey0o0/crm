import { supabase } from '../lib/supabaseClient';

// ==================== 역할 관리 ====================

// 모든 역할 조회
export const getRoles = async () => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('역할 조회 오류:', error);
    return { data: null, error };
  }
};

// 역할 생성
export const createRole = async (role) => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .insert(role)
      .select()
      .single();
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('역할 생성 오류:', error);
    return { data: null, error };
  }
};

// 역할 수정
export const updateRole = async (id, role) => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .update({ ...role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('역할 수정 오류:', error);
    return { data: null, error };
  }
};

// 역할 삭제
export const deleteRole = async (id) => {
  try {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('역할 삭제 오류:', error);
    return { error };
  }
};

// ==================== 권한 관리 ====================

// 특정 역할의 권한 조회
export const getRolePermissions = async (roleId) => {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('menu_key')
      .eq('role_id', roleId);
    
    if (error) throw error;
    return { data: data?.map(p => p.menu_key) || [], error: null };
  } catch (error) {
    console.error('권한 조회 오류:', error);
    return { data: [], error };
  }
};

// 역할의 권한 업데이트 (기존 권한 삭제 후 새로 추가)
export const updateRolePermissions = async (roleId, menuKeys) => {
  try {
    // 기존 권한 삭제
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);
    
    if (deleteError) throw deleteError;

    // 새 권한 추가
    if (menuKeys.length > 0) {
      const permissions = menuKeys.map(menuKey => ({
        role_id: roleId,
        menu_key: menuKey
      }));

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(permissions);
      
      if (insertError) throw insertError;
    }

    return { error: null };
  } catch (error) {
    console.error('권한 업데이트 오류:', error);
    return { error };
  }
};

// ==================== 사용자 역할 관리 ====================

// 특정 사용자의 역할 조회
export const getUserRoles = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        id,
        role_id,
        roles (
          id,
          name,
          description
        )
      `)
      .eq('user_id', userId);
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('사용자 역할 조회 오류:', error);
    return { data: null, error };
  }
};

// 사용자에게 역할 할당
export const assignUserRole = async (userId, roleId) => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleId })
      .select()
      .single();
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('역할 할당 오류:', error);
    return { data: null, error };
  }
};

// 이메일로 사용자에게 역할 할당
export const assignUserRoleByEmail = async (userEmail, roleId) => {
  try {
    // 이메일로 사용자 ID 조회
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      // admin API가 없는 경우 RPC 함수 사용 시도
      const { data: userId, error: rpcError } = await supabase
        .rpc('get_user_id_by_email', { email: userEmail });
      
      if (rpcError || !userId) {
        throw new Error('사용자를 찾을 수 없습니다');
      }
      
      return await assignUserRole(userId, roleId);
    }
    
    const user = users.find(u => u.email === userEmail);
    if (!user) {
      throw new Error('해당 이메일의 사용자를 찾을 수 없습니다');
    }
    
    return await assignUserRole(user.id, roleId);
  } catch (error) {
    console.error('이메일로 역할 할당 오류:', error);
    return { data: null, error };
  }
};

// 사용자의 역할 제거
export const removeUserRole = async (userId, roleId) => {
  try {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('역할 제거 오류:', error);
    return { error };
  }
};

// 사용자의 모든 권한 조회 (역할을 통해)
export const getUserPermissions = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        roles!inner (
          role_permissions (
            menu_key
          )
        )
      `)
      .eq('user_id', userId);
    
    if (error) throw error;
    
    // 중복 제거하여 권한 목록 추출
    const permissions = new Set();
    data?.forEach(ur => {
      ur.roles?.role_permissions?.forEach(rp => {
        permissions.add(rp.menu_key);
      });
    });
    
    return { data: Array.from(permissions), error: null };
  } catch (error) {
    console.error('사용자 권한 조회 오류:', error);
    return { data: [], error };
  }
};

// 모든 사용자 목록 조회 (역할 정보 포함)
export const getAllUsersWithRoles = async () => {
  try {
    // Supabase auth.users는 직접 접근 불가하므로 user_roles를 통해 조회
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        roles (
          id,
          name
        )
      `);
    
    if (error) throw error;
    
    // 사용자별로 역할 그룹화
    const userMap = {};
    data?.forEach(item => {
      if (!userMap[item.user_id]) {
        userMap[item.user_id] = {
          user_id: item.user_id,
          roles: []
        };
      }
      userMap[item.user_id].roles.push(item.roles);
    });
    
    return { data: Object.values(userMap), error: null };
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    return { data: [], error };
  }
};

