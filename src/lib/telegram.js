// 텔레그램 알림 전송 공통 함수
// notificationData: { message: "전송할 텍스트 메시지", link?: "관련 URL" }
// options: { parse_mode, 기타 텔레그램 sendMessage 옵션 }
export const sendTelegramNotification = async (notificationData, options = {}) => {
  const botToken = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || '7355852231:AAE4d36OyayXQbhSDPCJydDi0hte0f4R2x0';
  const chatId = process.env.REACT_APP_TELEGRAM_CHAT_ID || '-4682658690';
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  let textToSend = notificationData.message; // 기본 메시지

  // 링크가 있으면 메시지에 HTML 링크 추가
  if (notificationData.link) {
    // 링크 URL 생성 (절대 경로가 아닌 경우, 기본 URL을 앞에 붙여주어야 할 수 있음 - 현재는 그대로 사용)
    // 예: const fullLink = `https://your-app-domain.com${notificationData.link}`;
    // 여기서는 CRM 내부 링크이므로 그대로 사용합니다.
    textToSend += `\n<a href="${process.env.REACT_APP_BASE_URL || ''}${notificationData.link}">내용 확인하기</a>`;
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
      throw new Error(`Telegram API Error: ${response.status} ${response.statusText} - ${JSON.stringify(responseData)}`);
    }
    // 성공 시 응답 내용도 로깅 (선택적)
    // const responseData = await response.json();
    // console.log('텔레그램 API 성공 응답:', responseData);

  } catch (e) {
    console.error('텔레그램 알림 전송 실패:', e);
  }
}; 