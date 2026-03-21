const axios = require('axios');
require('dotenv').config();

// 이카운트 ERP 연동 기본 자격증명
const ECOUNT_COM_CODE = process.env.ECOUNT_COM_CODE || '678204';
const ECOUNT_USER_ID = process.env.ECOUNT_USER_ID || 'dummy_user';
const ECOUNT_API_KEY = process.env.ECOUNT_API_KEY || 'dummy_api_key';

let cachedZoneUrl = null;
let cachedZoneId = null;
let cachedSession = null;
let sessionExpiresAt = null;

/**
 * 1. Zone API 호출을 통해 사용해야 할 서버 도메인(Zone)을 확인합니다.
 */
async function getZoneUrl() {
  // 캐싱된 Zone이 있으면 재사용
  if (cachedZoneUrl) return { zoneUrl: cachedZoneUrl, zoneId: cachedZoneId };

  try {
    const response = await axios.post('https://sboapi.ecount.com/OAPI/V2/Zone', {
      COM_CODE: ECOUNT_COM_CODE
    });

    const data = response.data;
    // 정상 응답 확인 (200) 및 Zone 값 유무 확인
    if (data && String(data.Status) === '200' && data.Data && data.Data.ZONE) {
      cachedZoneId = data.Data.ZONE;
      cachedZoneUrl = `https://oapi${cachedZoneId.toLowerCase()}.ecount.com`;
      console.log(`[ECount] Zone 할당 완료: ${cachedZoneUrl}`);
      return { zoneUrl: cachedZoneUrl, zoneId: cachedZoneId };
    } else {
      throw new Error(`Zone API 응답 오류: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('[ECount] Zone 요청 실패:', errorDetails);
    throw error;
  }
}

/**
 * 2. Login API 호출을 통해 SESSION_ID를 발급받습니다.
 */
async function loginToEcount() {
  try {
    const { zoneUrl, zoneId } = await getZoneUrl();
    const loginUrl = `${zoneUrl}/OAPI/V2/OAPILogin`;

    const response = await axios.post(loginUrl, {
      COM_CODE: ECOUNT_COM_CODE,
      USER_ID: ECOUNT_USER_ID,
      API_CERT_KEY: ECOUNT_API_KEY,
      LAN_TYPE: 'ko-KR',
      ZONE: zoneId
    });

    const data = response.data;
    
    // 이카운트 로그인 성공 시 데이터 파싱
    if (data && String(data.Status) === '200' && data.Data && data.Data.Datas && data.Data.Datas.SESSION_ID) {
      const sessionId = data.Data.Datas.SESSION_ID;
      
      cachedSession = sessionId;
      // 발급받은 세션 유효기간을 30분으로 임시 설정 (이카운트 세션 만료 시간에 맞춰 향후 조정)
      sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000); 
      
      console.log(`[ECount] 정식 SESSION_ID 발급 완료`);
      return { SESSION_ID: sessionId, zoneUrl, isTest: false };
    } else if (data && String(data.Status) === '200' && data.Data && String(data.Data.Code) === '204') {
      // 테스트용 인증키인 경우
      console.log(`[ECount] 테스트용 인증키 정상 확인됨`);
      return { SESSION_ID: 'TEST_KEY_VERIFIED', zoneUrl, isTest: true, message: data.Data.Message };
    } else {
      throw new Error(`Login API 인증 실패: ${JSON.stringify(data.Errors || data)}`);
    }
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('[ECount] Login 요청 실패 (설정된 아이디/키가 올바른지 확인):', errorDetails);
    throw error;
  }
}

/**
 * 3. 유효한 세션을 반환합니다. 만료되었을 경우 재로그인을 수행합니다.
 */
async function getValidEcountSession() {
  // 세션이 존재하고, 아직 만료되지 않았다면 기존 세션 반환
  if (cachedSession && sessionExpiresAt && new Date() < sessionExpiresAt) {
    const { zoneUrl } = await getZoneUrl();
    return { SESSION_ID: cachedSession, zoneUrl };
  }
  // 세션이 없거나 만료되었을 경우 신규 발급
  return await loginToEcount();
}

/**
 * 범용 API 호출 래퍼 함수 (외부에서 재고, 주문 등을 연동할 때 이 함수를 사용합니다.)
 * @param {string} endpoint - API 엔드포인트 경로 (예: '/OAPI/V2/InventoryBalance/GetListInventoryBalance')
 * @param {object} payload - 요청 Payload (각 메뉴별 파라미터 규격 참고)
 */
async function executeEcountApi(endpoint, payload = {}) {
  try {
    const { SESSION_ID, zoneUrl } = await getValidEcountSession();
    // 쿼리 라우팅에서 ? SESSION_ID= 처리
    const url = `${zoneUrl}${endpoint}?SESSION_ID=${SESSION_ID}`;

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 200 이외에도 업무상 에러인지 체크 (각 API 포맷별 상이할 수 있음)
    if (response.data && String(response.data.Status) === '200') {
      return response.data;
    } else {
      throw new Error(`ECount API 업무 오류 / 오류코드: ${response.data.Status}, 상세: ${JSON.stringify(response.data.Errors)}`);
    }
  } catch (error) {
    console.error(`[ECount] API 호출 실패 (${endpoint}):`, error.message);
    throw error;
  }
}

module.exports = {
  getZoneUrl,
  loginToEcount,
  getValidEcountSession,
  executeEcountApi
};
