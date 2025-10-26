import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// 캐시 무효화 - React 렌더링을 막지 않도록 비동기 처리
setTimeout(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
        console.log('[Cache] Service Worker unregistered');
      });
    }).catch(err => {
      console.warn('[Cache] Service Worker unregister failed:', err);
    });
  }

  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
        console.log('[Cache] Cache storage cleared:', name);
      });
    }).catch(err => {
      console.warn('[Cache] Cache storage clear failed:', err);
    });
  }
}, 0);

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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <StyledEngineProvider injectFirst>
    <CssBaseline />
    <App />
  </StyledEngineProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
