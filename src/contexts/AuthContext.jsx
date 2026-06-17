import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getAppSetting } from '../api/settingsApi';
import { hasMenuAccess, getAllowedMalls, getAllowedBrands, hasActionPermission, MASTER_ACCOUNTS } from '../config/menuConfig';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      // ⚠️ 데드락 경고: onAuthStateChange 내부에서 await supabase.from() 등을 호출하면 절대 안됩니다.
      // gotrue-js 내부 락이 걸린 상태에서 PostgREST 쿼리가 세션을 대기하게 되어 영원한 무한 대기(Deadlock)에 빠집니다.
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        setTimeout(() => {
          loadMenuPermissions();
        }, 0);
      }
      
      // 세션 갱신 이벤트 등 주요 상태 변경 시 로딩을 강제로 풉니다 (무한 로딩 방지)
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        if (mounted) setLoading(false);
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

  const hasPermission = (menuKey) => {
    if (!user?.email) return false;
    return hasMenuAccess(user.email, menuKey, userMenuPermissions);
  };

  const allowedMalls = () => {
    if (!user?.email) return [];
    return getAllowedMalls(user.email, userMenuPermissions);
  };

  const actionPermission = (actionKey) => {
    if (!user?.email) return false;
    return hasActionPermission(user.email, actionKey, userMenuPermissions);
  };

  const allowedBrands = () => {
    if (!user?.email) return [];
    return getAllowedBrands(user.email, userMenuPermissions);
  };

  // 마스터(관리자) 계정 여부 — 재고 변경 등 민감 동작 제어용
  const isMaster = !!user?.email && MASTER_ACCOUNTS.includes(user.email);

  const value = {
    user,
    session,
    loading,
    userMenuPermissions,
    isMaster,
    hasPermission,
    getAllowedMalls: allowedMalls,
    getAllowedBrands: allowedBrands,
    hasActionPermission: actionPermission,
    refreshMenuPermissions: loadMenuPermissions,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
          <div style={{ padding: '20px', fontSize: '1.2rem' }}>앱 데이터를 로딩 중입니다... (10초 이상 지속되면 새로고침 해주세요)</div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};
