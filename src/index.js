import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// 개발 환경에서 ReactQuill의 findDOMNode 경고만 무시
if (process.env.NODE_ENV === 'development') {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    try {
      const firstArg = args && args[0];
      if (typeof firstArg === 'string' && firstArg.includes('findDOMNode is deprecated')) {
        return; // 특정 경고만 무시
      }
    } catch (_) {
      // no-op
    }
    originalConsoleError(...args);
  };
}

// 환경 변수 로드 대기 함수
const waitForEnv = () => {
  return new Promise((resolve) => {
    // 이미 로드되어 있고 Supabase 값이 있으면 즉시 반환
    if (typeof window !== 'undefined' && window._env_) {
      const hasSupabase = window._env_.REACT_APP_SUPABASE_URL && window._env_.REACT_APP_SUPABASE_ANON_KEY;
      if (hasSupabase) {
        console.log('[App Init] 환경 변수 로드됨:', {
          keys: Object.keys(window._env_),
          hasSupabaseUrl: !!window._env_.REACT_APP_SUPABASE_URL,
          hasSupabaseKey: !!window._env_.REACT_APP_SUPABASE_ANON_KEY
        });
        resolve();
        return;
      }
    }
    
    // 최대 10초 대기 (모바일에서 네트워크가 느릴 수 있음)
    let attempts = 0;
    const maxAttempts = 100; // 100ms * 100 = 10초
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && window._env_) {
        const hasSupabase = window._env_.REACT_APP_SUPABASE_URL && window._env_.REACT_APP_SUPABASE_ANON_KEY;
        if (hasSupabase) {
          console.log('[App Init] 환경 변수 로드됨 (대기 후):', {
            attempts,
            keys: Object.keys(window._env_),
            hasSupabaseUrl: !!window._env_.REACT_APP_SUPABASE_URL,
            hasSupabaseKey: !!window._env_.REACT_APP_SUPABASE_ANON_KEY
          });
          clearInterval(checkInterval);
          resolve();
          return;
        }
      }
      
      if (attempts >= maxAttempts) {
        console.error('[App Init] 환경 변수 로드 타임아웃', {
          hasWindow: typeof window !== 'undefined',
          hasEnv: typeof window !== 'undefined' && !!window._env_,
          envKeys: typeof window !== 'undefined' && window._env_ ? Object.keys(window._env_) : []
        });
        // 타임아웃이어도 계속 진행 (개발 환경에서는 에러 표시)
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
};

// 앱 초기화
const initApp = async () => {
  await waitForEnv();
  
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <StyledEngineProvider injectFirst>
      <CssBaseline />
      <App />
    </StyledEngineProvider>
  );
};

initApp();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
