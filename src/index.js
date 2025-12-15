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
