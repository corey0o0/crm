import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getUserPermissions } from '../api/roleApi';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  // 사용자 권한 로드 함수
  const loadUserPermissions = async (userId) => {
    if (!userId) {
      setUserPermissions([]);
      setUserRoles([]);
      return;
    }

    try {
      const { data: permissions } = await getUserPermissions(userId);
      setUserPermissions(permissions || []);

      // 사용자 역할 정보도 함께 로드
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select(`
          roles (
            id,
            name,
            description
          )
        `)
        .eq('user_id', userId);
      
      setUserRoles(rolesData?.map(r => r.roles) || []);
    } catch (error) {
      console.error('권한 로드 오류:', error);
      setUserPermissions([]);
      setUserRoles([]);
    }
  };

  // 권한 체크 함수
  const hasPermission = (menuKey) => {
    // 권한 정보가 없으면 기본적으로 접근 허용 (하위 호환성)
    if (userPermissions.length === 0) {
      return true;
    }
    return userPermissions.includes(menuKey);
  };

  // 특정 역할을 가지고 있는지 확인
  const hasRole = (roleName) => {
    return userRoles.some(role => role.name === roleName);
  };

  useEffect(() => {
    // 초기 세션 확인
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user || null;
        setUser(currentUser);
        
        // 사용자가 있으면 권한 로드
        if (currentUser) {
          await loadUserPermissions(currentUser.id);
        }
        
        setLoading(false);

        // 세션 변경 감지
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          const currentUser = session?.user || null;
          setUser(currentUser);
          
          // 사용자가 변경되면 권한 다시 로드
          if (currentUser) {
            await loadUserPermissions(currentUser.id);
          } else {
            setUserPermissions([]);
            setUserRoles([]);
          }
          
          setLoading(false);
        });

        return () => {
          if (subscription) subscription.unsubscribe();
        };
      } catch (error) {
        console.error('세션 초기화 오류:', error);
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    userPermissions,
    userRoles,
    hasPermission,
    hasRole,
    loadUserPermissions
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 