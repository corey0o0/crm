// 텔레그램 알림 전송 공통 함수
// message: 전송할 텍스트 메시지
// options: { parse_mode, 기타 텔레그램 sendMessage 옵션 }
export const sendTelegramNotification = async (message, options = {}) => {
  const botToken = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || '7355852231:AAE4d36OyayXQbhSDPCJydDi0hte0f4R2x0';
  const chatId = process.env.REACT_APP_TELEGRAM_CHAT_ID || '-4682658690';
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: options.parse_mode || 'HTML',
        ...options
      })
    });
  } catch (e) {
    console.error('텔레그램 알림 전송 실패:', e);
  }
}; 