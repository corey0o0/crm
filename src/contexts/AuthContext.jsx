import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getAppSetting } from '../api/settingsApi';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 로컬 스토리지에서 캐시된 권한 데이터 가져오기 (초기 로딩 속도 최적화)
  const getCachedPermissions = () => {
    try {
      const cached = localStorage.getItem('crm_user_menu_permissions');
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      return {};
    }
  };

  const [userMenuPermissions, setUserMenuPermissions] = useState(getCachedPermissions());

  const loadMenuPermissions = async () => {
    try {
      const { data } = await getAppSetting('user_menu_permissions');
      if (data) {
        setUserMenuPermissions(data);
        localStorage.setItem('crm_user_menu_permissions', JSON.stringify(data));
      } else {
        setUserMenuPermissions({});
        localStorage.removeItem('crm_user_menu_permissions');
      }
    } catch (err) {
      console.error('[AuthContext] 메뉴 권한 로드 오류:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 초기 세션 확인
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user || null);
        
        // 권한 불러오기 (비동기로 실행하여 로딩 차단 방지)
        if (session?.user) {
          loadMenuPermissions(); // await를 제거하여 즉시 다음 줄로 넘어감
        }
        
        if (mounted) setLoading(false);
      } catch (error) {
        console.error('[AuthContext] 세션 초기화 오류:', error);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // 세션 변경 이벤트 감지 (initSession 바깥으로 분리)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthContext] Auth event: ${event}`);
      if (!mounted) return;
      
      // 로그아웃 처리
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserMenuPermissions({});
        return;
      }
      
      setSession(session);
      setUser(session?.user || null);
      
      // INITIAL_SESSION은 initSession에서 처리하므로, 여기서는 SIGNED_IN 등에서만 권한을 다시 로드합니다.
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        await loadMenuPermissions();
      }
    });

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
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
      console.log('[AuthContext] 로그아웃 시작');
      
      // 로컬 상태 먼저 클리어
      setUser(null);
      setSession(null);
      setUserMenuPermissions({});
      localStorage.removeItem('crm_user_menu_permissions');
      
      // Supabase 로그아웃
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        // 403 오류는 이미 로그아웃된 상태이므로 무시
        if (error.status === 403 || error.message?.includes('403')) {
          console.log('[AuthContext] 이미 로그아웃된 세션 (403 무시)');
        } else {
          console.error('[AuthContext] 로그아웃 오류:', error);
        }
      }
      
      console.log('[AuthContext] 로그아웃 완료');
    } catch (error) {
      console.error('[AuthContext] 로그아웃 예외:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    userMenuPermissions,
    refreshMenuPermissions: loadMenuPermissions,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
