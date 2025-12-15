import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// iOS 사파리/프라이빗 환경 등에서 localStorage 접근 시 SecurityError가 발생해 앱이 멈추는 문제 방지
(() => {
  const createMemoryStorage = () => {
    const store = new Map();
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
      clear: () => { store.clear(); },
      key: (index) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size; }
    };
  };

  try {
    const testKey = '__crm_storage_test__';
    window.localStorage.setItem(testKey, 'ok');
    window.localStorage.removeItem(testKey);
  } catch (storageError) {
    console.warn('[Storage Guard] localStorage 사용 불가, 메모리 스토리지로 대체합니다:', storageError);
    const memoryStorage = createMemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: false,
      enumerable: true,
      writable: false
    });
  }

  try {
    const testKey = '__crm_session_test__';
    window.sessionStorage.setItem(testKey, 'ok');
    window.sessionStorage.removeItem(testKey);
  } catch (storageError) {
    console.warn('[Storage Guard] sessionStorage 사용 불가, 메모리 스토리지로 대체합니다:', storageError);
    const memoryStorage = createMemoryStorage();
    Object.defineProperty(window, 'sessionStorage', {
      value: memoryStorage,
      configurable: false,
      enumerable: true,
      writable: false
    });
  }
})();

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
