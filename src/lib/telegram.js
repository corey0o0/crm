import { getAppSetting } from '../api/settingsApi';

// 텔레그램 알림 전송 공통 함수 (안전하게 백엔드를 거쳐 발송)
// notificationData: { message: "전송할 텍스트 메시지", link?: "관련 URL" }
// options: { parse_mode, eventType, 기타 텔레그램 sendMessage 옵션 }
export const sendTelegramNotification = async (notificationData, options = {}) => {
  // 이벤트 타입이 지정된 경우 설정값 확인
  if (options.eventType) {
    try {
      const { data: settings } = await getAppSetting('telegram_settings');
      // 설정 데이터가 존재하고 해당 이벤트 타입이 명시적으로 꺼져 있는 경우 전송 안 함
      if (settings && settings[options.eventType] === false) {
        console.log(`[텔레그램] 설정에 의해 전송이 취소되었습니다. (eventType: ${options.eventType})`);
        return { success: true, bypassed: true }; // 처리 완료로 취급 (에러 무시)
      }
      else if (!settings || settings[options.eventType] === undefined) {
        // 설정이 아예 없거나 해당 키가 없을 경우, 기본값(OFF)으로 동작하게 할지 고민이지만,
        // OFF가 기본값이므로 전송 안하는게 맞음.
        console.log(`[텔레그램] 기본값(OFF)에 의해 전송이 취소되었습니다. (eventType: ${options.eventType})`);
        return { success: true, bypassed: true };
      }
    } catch (err) {
      console.warn('[텔레그램] 설정 로드 중 오류 발생, 무시하고 진행합니다.', err);
    }
  }

  // 백엔드 주소 (개발/운영 환경별 자동 분기)
  const baseUrl = process.env.REACT_APP_BACKEND_URL || (process.env.NODE_ENV === 'production' 
    ? 'https://crm-production-067b.up.railway.app' 
    : `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5001`);

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
    if (key !== 'message' && key !== 'link' && key !== 'eventType' && !payload.hasOwnProperty(key)) {
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
    console.error('[텔레그램] 알림 전송 실패:', e instanceof Error ? e.message : e);
    // 앱 크래시 방지를 위해 텔레그램 에러는 조용히 실패시킴
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
};