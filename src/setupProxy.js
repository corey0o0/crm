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
}; 