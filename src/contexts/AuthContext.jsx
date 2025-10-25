import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
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

  // 중복 호출 방지용 ref
  const loadingPermissionsRef = useRef(false);
  const lastSessionRefreshRef = useRef(0);

  // 사용자 권한 로드 함수 (중복 호출 방지)
  const loadUserPermissions = async (userId) => {
    if (!userId) {
      setUserPermissions([]);
      setUserRoles([]);
      return;
    }

    // 이미 로딩 중이면 스킵
    if (loadingPermissionsRef.current) {
      console.log('[AuthContext] 권한 로딩 중복 호출 방지');
      return;
    }

    loadingPermissionsRef.current = true;
    const timestamp = new Date().toISOString();
    console.log(`[AuthContext ${timestamp}] 권한 로드 시작 (userId: ${userId})`);

    try {
      const { data: permissions, error: permError } = await getUserPermissions(userId);
      
      if (permError) {
        console.error(`[AuthContext ${timestamp}] 권한 로드 오류:`, permError);
        // 재시도 (1회)
        console.log(`[AuthContext ${timestamp}] 권한 로드 재시도 중...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        const { data: retryPermissions } = await getUserPermissions(userId);
        setUserPermissions(retryPermissions || []);
      } else {
        setUserPermissions(permissions || []);
      }

      // 사용자 역할 정보도 함께 로드
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          roles (
            id,
            name,
            description
          )
        `)
        .eq('user_id', userId);
      
      if (rolesError) {
        console.error(`[AuthContext ${timestamp}] 역할 로드 오류:`, rolesError);
        // 재시도 (1회)
        console.log(`[AuthContext ${timestamp}] 역할 로드 재시도 중...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        const { data: retryRolesData } = await supabase
          .from('user_roles')
          .select(`
            roles (
              id,
              name,
              description
            )
          `)
          .eq('user_id', userId);
        setUserRoles(retryRolesData?.map(r => r.roles) || []);
      } else {
        setUserRoles(rolesData?.map(r => r.roles) || []);
      }
      
      console.log(`[AuthContext ${timestamp}] 권한 로드 완료`);
    } catch (error) {
      console.error(`[AuthContext ${timestamp}] 권한 로드 최종 실패:`, error);
      setUserPermissions([]);
      setUserRoles([]);
    } finally {
      loadingPermissionsRef.current = false;
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

  // 포커스/가시성 복귀 시 세션 새로고침 및 권한 재로딩 (쓰로틀링 적용)
  const refreshSessionAndPermissions = async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastSessionRefreshRef.current;
    
    // 3초 이내 재호출 방지 (10초에서 단축)
    if (timeSinceLastRefresh < 3000) {
      console.log('[AuthContext] 세션 새로고침 쓰로틀링 (3초 이내 재호출)');
      return;
    }

    lastSessionRefreshRef.current = now;
    const timestamp = new Date().toISOString();
    console.log(`[AuthContext ${timestamp}] 세션 새로고침 시작`);

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
      console.log(`[AuthContext ${timestamp}] 세션 새로고침 완료`);
    } catch (e) {
      console.error(`[AuthContext ${timestamp}] 세션 새로고침 실패:`, e);
    }
  };

  // 외부에서 호출 가능한 세션 보강 함수 (쓰로틀링 적용)
  const ensureSessionFresh = async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastSessionRefreshRef.current;
    
    // 10초 이내 재호출 방지
    if (timeSinceLastRefresh < 10000) {
      console.log('[AuthContext] ensureSessionFresh 쓰로틀링 (10초 이내 재호출)');
      return;
    }

    lastSessionRefreshRef.current = now;

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
          console.log(`[AuthContext] Auth event: ${event}`);
          
          // SIGNED_OUT 이벤트는 여러 번 발생할 수 있으므로 명시적 처리
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setUserPermissions([]);
            setUserRoles([]);
            setLoading(false);
            return;
          }
          
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

        // 포커스/가시성 복귀 시 즉시 세션/권한 동기화
        const handleFocus = async () => { 
          console.log('[AuthContext] 포커스 복귀 - 세션 갱신 시작');
          await refreshSessionAndPermissions(); 
        };
        const handleVisibility = async () => { 
          if (document.visibilityState === 'visible') {
            console.log('[AuthContext] 가시성 복귀 - 세션 갱신 시작');
            await refreshSessionAndPermissions(); 
          }
        };
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
          const timestamp = new Date().toISOString();
          console.log(`[AuthContext ${timestamp}] 하트비트 핑 전송`);
          // 초경량 head 카운트 쿼리
          await supabase
            .from('roles')
            .select('id', { count: 'exact', head: true });
        } catch (_) {
          // 무시 (하트비트 실패는 치명적이지 않음)
        }
      }, 30000); // 30초로 단축
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
      console.log('[AuthContext] 로그아웃 시작');
      
      // 로컬 상태 먼저 클리어
      setUser(null);
      setSession(null);
      setUserPermissions([]);
      setUserRoles([]);
      
      // Supabase 로그아웃 시도 (403 오류 무시)
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
      // 오류가 발생해도 로컬 상태는 이미 클리어되었으므로 계속 진행
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