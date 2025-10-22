const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // API 키 확인
  const apiKey = process.env.REACT_APP_CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('경고: REACT_APP_CLAUDE_API_KEY 환경 변수가 설정되지 않았습니다.');
  } else {
    console.log('Claude API 키 설정됨 (일부):', apiKey.substring(0, 5) + '...');
  }

  app.use(
    '/api/claude',
    createProxyMiddleware({
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/claude': ''
      },
      // 헤더를 직접 설정
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      onProxyReq: (proxyReq, req, res) => {
        // 추가 디버깅 로그
        console.log('프록시 요청 경로:', req.path);
        console.log('프록시 요청 메서드:', req.method);
        console.log('프록시 요청 헤더:', proxyReq.getHeaders());
      },
      logLevel: 'debug',
    })
  );

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