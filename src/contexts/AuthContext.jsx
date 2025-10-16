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
    // 기본 거부: 권한이 없으면 접근 불가
    if (!user) return false;
    return userPermissions.includes(menuKey);
  };

  // 특정 역할을 가지고 있는지 확인
  const hasRole = (roleName) => {
    return userRoles.some(role => role.name === roleName);
  };

  // 포커스/가시성 복귀 시 세션 새로고침 및 권한 재로딩
  const refreshSessionAndPermissions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (!session) {
        // 세션이 없으면 새로고침 시도
        await supabase.auth.refreshSession();
      }
      const currentUser = session?.user || null;
      if (currentUser) {
        await loadUserPermissions(currentUser.id);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('세션 새로고침 실패:', e);
    }
  };

  // 외부에서 호출 가능한 세션 보강 함수
  const ensureSessionFresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (!session) {
        await supabase.auth.refreshSession();
        return;
      }
      // 만료 60초 전이면 갱신 시도
      const exp = session.expires_at; // seconds
      if (exp && exp * 1000 - Date.now() < 60_000) {
        await supabase.auth.refreshSession();
      }
    } catch (e) {
      console.error('ensureSessionFresh 오류:', e);
    }
  };

  useEffect(() => {
    // 초기 세션 확인
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        const currentUser = session?.user || null;
        setUser(currentUser);
        
        // 사용자가 있으면 권한 로드
        if (currentUser) {
          await loadUserPermissions(currentUser.id);
        }
        
        setLoading(false);

        // 세션 변경/토큰 이벤트 감지
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          setSession(session);
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

          // 토큰 새로고침 이벤트 시 권한 동기화
          if (event === 'TOKEN_REFRESHED') {
            if (currentUser) {
              await loadUserPermissions(currentUser.id);
            }
          }
          // 토큰 새로고침 실패 시 재시도
          if (event === 'TOKEN_REFRESH_FAILED') {
            try { await supabase.auth.refreshSession(); } catch {}
          }
        });

        // 포커스/가시성 복귀 시 세션/권한 동기화
        const handleFocus = () => { refreshSessionAndPermissions(); };
        const handleVisibility = () => { if (document.visibilityState === 'visible') refreshSessionAndPermissions(); };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
          if (subscription) subscription.unsubscribe();
          window.removeEventListener('focus', handleFocus);
          document.removeEventListener('visibilitychange', handleVisibility);
        };
      } catch (error) {
        console.error('세션 초기화 오류:', error);
        setLoading(false);
      }
    };

    initSession();
  }, []);

  // 2분 주기 하트비트로 idle 연결 안정화 (가시성 hidden 시 중단)
  useEffect(() => {
    let intervalId;
    const startHeartbeat = () => {
      if (intervalId) return;
      intervalId = setInterval(async () => {
        try {
          if (document.visibilityState !== 'visible') return;
          // 초경량 head 카운트 쿼리
          await supabase
            .from('roles')
            .select('id', { count: 'exact', head: true });
        } catch (_) {
          // 무시 (하트비트 실패는 치명적이지 않음)
        }
      }, 120000); // 2분
    };
    const stopHeartbeat = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') startHeartbeat();
      else stopHeartbeat();
    };
    startHeartbeat();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopHeartbeat();
      document.removeEventListener('visibilitychange', onVisibility);
    };
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