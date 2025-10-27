import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 세션 확인
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user || null);
        setLoading(false);

        // 세션 변경 이벤트 감지
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log(`[AuthContext] Auth event: ${event}`);
          
          // 로그아웃 처리
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            return;
          }
          
          setSession(session);
          setUser(session?.user || null);
        });

        return () => {
          if (subscription) subscription.unsubscribe();
        };
      } catch (error) {
        console.error('[AuthContext] 세션 초기화 오류:', error);
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
      console.log('[AuthContext] 로그아웃 시작');
      
      // 로컬 상태 먼저 클리어
      setUser(null);
      setSession(null);
      
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
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 
