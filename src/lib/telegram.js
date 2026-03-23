// 텔레그램 알림 전송 공통 함수 (안전하게 백엔드를 거쳐 발송)
// notificationData: { message: "전송할 텍스트 메시지", link?: "관련 URL" }
// options: { parse_mode, 기타 텔레그램 sendMessage 옵션 }
export const sendTelegramNotification = async (notificationData, options = {}) => {
  // 백엔드 주소 (개발/운영 환경별 자동 분기)
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://crm-production-067b.up.railway.app' 
    : 'http://localhost:5001';

  let textToSend = notificationData.message;

  // 링크가 있으면 메시지에 HTML 링크 추가
  if (notificationData.link) {
    const frontendBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    textToSend += `\n<a href="${frontendBaseUrl}${notificationData.link}">내용 확인하기</a>`;
  }

  const payload = {
    text: textToSend,
    parse_mode: options.parse_mode || 'HTML',
    ...options
  };

  // notificationData 객체에서 message와 link를 제외한 나머지 속성을 payload에 추가 (덮어쓰기 방지)
  for (const key in notificationData) {
    if (key !== 'message' && key !== 'link' && !payload.hasOwnProperty(key)) {
      payload[key] = notificationData[key];
    }
  }

  console.log('[텔레그램] 백엔드 프록시로 전송 요청:', { url: `${baseUrl}/api/telegram/send`, payload });

  try {
    const response = await fetch(`${baseUrl}/api/telegram/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const responseData = await response.json();
      console.error('[텔레그램] 백엔드 프록시 API 오류 응답:', responseData);
      throw new Error(`Telegram Backend Proxy Error: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('[텔레그램] 알림 전송 성공:', responseData);
    return { success: true, data: responseData };
  } catch (e) {
    console.error('[텔레그램] 알림 전송 실패:', e);
    // 앱 크래시 방지를 위해 텔레그램 에러는 조용히 실패시킴
    return { success: false, error: e.message };
  }
};