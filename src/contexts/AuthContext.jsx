import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getUserPermissions } from '../api/roleApi';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  // 권한 로드 함수 (단순화)
  const loadUserPermissions = async (userId) => {
    if (!userId) {
      setUserPermissions([]);
      setUserRoles([]);
      return;
    }

    try {
      console.log('[Auth] 권한 로드 시작:', userId);
      
      // 권한 로드
      const { data: permissions, error: permError } = await getUserPermissions(userId);
      if (permError) {
        console.error('[Auth] 권한 로드 실패:', permError);
        setUserPermissions([]);
      } else {
        setUserPermissions(permissions || []);
      }

      // 역할 로드
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('roles(id, name, description)')
        .eq('user_id', userId);
      
      if (rolesError) {
        console.error('[Auth] 역할 로드 실패:', rolesError);
        setUserRoles([]);
      } else {
        setUserRoles(rolesData?.map(r => r.roles) || []);
      }
      
      console.log('[Auth] 권한 로드 완료');
    } catch (error) {
      console.error('[Auth] 권한 로드 오류:', error);
      setUserPermissions([]);
      setUserRoles([]);
    }
  };

  // 권한 체크
  const hasPermission = (menuKey) => {
    if (!user) return false;
    return userPermissions.includes(menuKey);
  };

  // 역할 체크
  const hasRole = (roleName) => {
    return userRoles.some(role => role.name === roleName);
  };

  // 초기화 및 인증 상태 변경 감지
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 현재 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        const currentUser = session?.user || null;
        setUser(currentUser);
        
        // 권한 로드
        if (currentUser) {
          await loadUserPermissions(currentUser.id);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('[Auth] 초기화 오류:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] 상태 변경:', event);
      
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserPermissions([]);
        setUserRoles([]);
        return;
      }

      setSession(session);
      const currentUser = session?.user || null;
      setUser(currentUser);
      
      if (currentUser) {
        await loadUserPermissions(currentUser.id);
      } else {
        setUserPermissions([]);
        setUserRoles([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 로그인
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

  // 로그아웃
  const signOut = async () => {
    try {
      console.log('[Auth] 로그아웃');
      
      // 로컬 상태 클리어
      setUser(null);
      setSession(null);
      setUserPermissions([]);
      setUserRoles([]);
      
      // Supabase 로그아웃
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('[Auth] 로그아웃 오류:', error);
    }
  };

  const value = {
    user,
    session,
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
