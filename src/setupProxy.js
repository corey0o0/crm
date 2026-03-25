const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Supabase REST 프록시 (dev 전용): 브라우저에서 HTTP/3(QUIC) 회피 → dev 서버를 통한 HTTP/1.1 경유
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  if (supabaseUrl) {
    app.use(
      '/__sb',
      createProxyMiddleware({
        target: supabaseUrl,
        changeOrigin: true,
        ws: true, // WebSocket 지원 활성화
        pathRewrite: {
          '^/__sb': ''
        },
        logLevel: 'silent',
        onError: (err, req, res) => {
          console.error('[Supabase Proxy] Error:', err.message);
        }
      })
    );
    console.log('[Supabase Proxy] Initialized with WebSocket support');
  } else {
    console.warn('REACT_APP_SUPABASE_URL 미설정: Supabase 프록시 비활성화');
  }

  // Ollama 프록시 (CORS 문제 해결)
  app.use(
    '/__ollama',
    createProxyMiddleware({
      target: 'http://localhost:11434',
      changeOrigin: true,
      pathRewrite: {
        '^/__ollama': ''
      },
      logLevel: 'silent',
      onError: (err, req, res) => {
        console.error('[Ollama Proxy] Error:', err.message);
      },
      onProxyReq: (proxyReq, req, res) => {
        // CORS 헤더 추가
        proxyReq.setHeader('Origin', 'http://localhost:11434');
      },
      onProxyRes: (proxyRes, req, res) => {
        // CORS 헤더 추가
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      }
    })
  );
  console.log('[Ollama Proxy] Initialized at /__ollama -> http://localhost:11434');

  // Backend API 프록시 (포트 5001)
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.error('[API Proxy] Error:', err.message);
      }
    })
  );
  console.log('[API Proxy] Initialized at /api -> http://localhost:5001');
}; 