// 텔레그램 알림 전송 공통 함수
// message: 전송할 텍스트 메시지
// options: { parse_mode, 기타 텔레그램 sendMessage 옵션 }
export const sendTelegramNotification = async (message, options = {}) => {
  const botToken = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || '7355852231:AAE4d36OyayXQbhSDPCJydDi0hte0f4R2x0';
  const chatId = process.env.REACT_APP_TELEGRAM_CHAT_ID || '-4682658690';
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: options.parse_mode || 'HTML',
    ...options
  };

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
      throw new Error(`Telegram API Error: ${response.status} ${response.statusText} - ${JSON.stringify(responseData)}`);
    }
    // 성공 시 응답 내용도 로깅 (선택적)
    // const responseData = await response.json();
    // console.log('텔레그램 API 성공 응답:', responseData);

  } catch (e) {
    console.error('텔레그램 알림 전송 실패:', e);
  }
}; 