import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ErrorBoundary from './components/ErrorBoundary';

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

// ResizeObserver 에러 무시 (UI 렌더링에 영향 없는 브라우저 수준의 경고)
window.addEventListener('error', e => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || e.message === 'ResizeObserver loop limit exceeded') {
    const resizeObserverErrDiv = document.getElementById(
      'webpack-dev-server-client-overlay-div'
    );
    const resizeObserverErr = document.getElementById(
      'webpack-dev-server-client-overlay'
    );
    if (resizeObserverErr) resizeObserverErr.setAttribute('style', 'display: none');
    if (resizeObserverErrDiv) resizeObserverErrDiv.setAttribute('style', 'display: none');
    
    e.stopImmediatePropagation();
  }
});

// 환경 변수 로드 대기 함수
const waitForEnv = () => {
  return new Promise((resolve) => {
    // 이미 로드되어 있으면 즉시 반환
    if (typeof window !== 'undefined' && window._env_) {
      console.log('[App Init] 환경 변수 로드됨:', Object.keys(window._env_));
      resolve();
      return;
    }
    
    // 최대 5초 대기
    let attempts = 0;
    const maxAttempts = 50; // 100ms * 50 = 5초
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && window._env_) {
        console.log('[App Init] 환경 변수 로드됨 (대기 후):', Object.keys(window._env_));
        clearInterval(checkInterval);
        resolve();
      } else if (attempts >= maxAttempts) {
        console.warn('[App Init] 환경 변수 로드 타임아웃, 계속 진행');
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });
};

// 앱 초기화
const initApp = async () => {
  try {
    await waitForEnv();
    
    // 환경 변수 최종 확인
    if (typeof window !== 'undefined' && window._env_) {
      const hasSupabase = window._env_.REACT_APP_SUPABASE_URL && window._env_.REACT_APP_SUPABASE_ANON_KEY;
      if (!hasSupabase) {
        console.error('[App Init] Supabase 환경 변수가 없습니다:', {
          hasEnv: !!window._env_,
          keys: Object.keys(window._env_),
          hasUrl: !!window._env_.REACT_APP_SUPABASE_URL,
          hasKey: !!window._env_.REACT_APP_SUPABASE_ANON_KEY
        });
      }
    }
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
      <ErrorBoundary>
        <StyledEngineProvider injectFirst>
          <CssBaseline />
          <App />
        </StyledEngineProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[App Init] 앱 초기화 실패:', error);
    
    // 에러를 화면에 표시
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="padding: 20px; font-family: sans-serif;">
          <h2 style="color: red;">앱 초기화 실패</h2>
          <p><strong>에러:</strong> ${error.message}</p>
          <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${error.stack || JSON.stringify(error, null, 2)}</pre>
          <p style="margin-top: 20px;">
            <strong>환경 변수 상태:</strong><br>
            window._env_ 존재: ${typeof window !== 'undefined' && !!window._env_}<br>
            ${typeof window !== 'undefined' && window._env_ 
              ? `환경 변수 키: ${Object.keys(window._env_).join(', ')}` 
              : '환경 변수 없음'}
          </p>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px;">
            새로고침
          </button>
        </div>
      `;
    }
  }
};

initApp();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
