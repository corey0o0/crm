// 텔레그램 알림 전송 공통 함수
// notificationData: { message: "전송할 텍스트 메시지", link?: "관련 URL" }
// options: { parse_mode, 기타 텔레그램 sendMessage 옵션 }
export const sendTelegramNotification = async (notificationData, options = {}) => {
  // window._env_ 우선 사용 (React 앱에서 환경 변수는 window._env_에 저장됨)
  const botToken = (typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN) 
    || process.env.REACT_APP_TELEGRAM_BOT_TOKEN 
    || '7355852231:AAE4d36OyayXQbhSDPCJydDi0hte0f4R2x0';
  const chatId = (typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_CHAT_ID) 
    || process.env.REACT_APP_TELEGRAM_CHAT_ID 
    || '-4682658690';
  const baseUrl = (typeof window !== 'undefined' && window._env_?.REACT_APP_BASE_URL) 
    || process.env.REACT_APP_BASE_URL 
    || '';

  // 디버깅: 환경 변수 로드 상태 확인
  const envSource = {
    hasWindowEnv: typeof window !== 'undefined' && !!window._env_,
    hasWindowToken: typeof window !== 'undefined' && !!window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN,
    hasProcessToken: !!process.env.REACT_APP_TELEGRAM_BOT_TOKEN,
    tokenLength: botToken ? botToken.length : 0,
    tokenPrefix: botToken ? botToken.substring(0, 10) + '...' : '없음',
    usingFallback: !(typeof window !== 'undefined' && window._env_?.REACT_APP_TELEGRAM_BOT_TOKEN) && !process.env.REACT_APP_TELEGRAM_BOT_TOKEN
  };
  console.log('[텔레그램] 환경 변수 상태:', envSource);

  // 토큰 유효성 검사
  if (!botToken || botToken.length < 20) {
    console.error('[텔레그램] 봇 토큰이 유효하지 않습니다:', { botToken: botToken ? '설정됨' : '없음', length: botToken?.length });
    console.warn('[텔레그램] 알림 전송을 건너뜁니다. 토큰을 설정하면 다시 작동합니다.');
    return { success: false, error: 'InvalidToken', message: '텔레그램 봇 토큰이 설정되지 않았거나 유효하지 않습니다.' };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  let textToSend = notificationData.message; // 기본 메시지

  // 링크가 있으면 메시지에 HTML 링크 추가
  if (notificationData.link) {
    // 링크 URL 생성 (절대 경로가 아닌 경우, 기본 URL을 앞에 붙여주어야 할 수 있음 - 현재는 그대로 사용)
    // 예: const fullLink = `https://your-app-domain.com${notificationData.link}`;
    // 여기서는 CRM 내부 링크이므로 그대로 사용합니다.
    textToSend += `\n<a href="${baseUrl}${notificationData.link}">내용 확인하기</a>`;
  }

  const payload = {
    chat_id: chatId,
    text: textToSend,
    parse_mode: options.parse_mode || 'HTML', // HTML 파싱을 위해 parse_mode 유지
    ...options
  };

  // notificationData 객체에서 message와 link를 제외한 나머지 속성을 payload에 추가 (덮어쓰기 방지)
  for (const key in notificationData) {
    if (key !== 'message' && key !== 'link' && !payload.hasOwnProperty(key)) {
      payload[key] = notificationData[key];
    }
  }

  console.log('텔레그램 알림 전송 요청:', { url, payload }); // 요청 데이터 로깅

  try {
    const response = await fetch(url, { // response 변수 추가
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // 응답 상태 로깅
    console.log('텔레그램 API 응답 상태:', response.status);
    if (!response.ok) {
      const responseData = await response.json();
      console.error('텔레그램 API 오류 응답:', responseData);
      
      // 401 에러인 경우 상세한 디버깅 정보 제공 및 조용히 실패
      if (response.status === 401) {
        const errorInfo = {
          error: responseData.description || responseData.error_code,
          tokenSource: envSource,
          tokenValid: botToken && botToken.length > 20,
          message: '텔레그램 봇 토큰이 만료되었거나 잘못되었습니다. BotFather에서 새 토큰을 발급받아 env.js에 업데이트하세요.'
        };
        console.error('[텔레그램 401 에러]', errorInfo);
        console.warn('[텔레그램] 알림 전송을 건너뜁니다. 토큰을 업데이트하면 다시 작동합니다.');
        // 401 에러는 조용히 실패 (앱 크래시 방지)
        return { success: false, error: 'Unauthorized', message: errorInfo.message };
      }
      
      // 다른 에러는 기존대로 throw
      throw new Error(`Telegram API Error: ${response.status} ${response.statusText} - ${JSON.stringify(responseData)}`);
    }
    
    // 성공 응답 반환
    const responseData = await response.json();
    console.log('텔레그램 API 성공 응답:', responseData);
    return { success: true, data: responseData };

  } catch (e) {
    console.error('텔레그램 알림 전송 실패:', e);
    // 네트워크 에러 등 기타 에러는 조용히 실패
    return { success: false, error: e.message };
  }
}; 