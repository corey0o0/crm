const axios = require('axios');

async function testProductsVerification() {
  try {
    const COM_CODE = '678204';
    const TEST_KEY = '374cb9bc9186d4234a183c0a470302ad32';
    const USER_ID = 'slimpack';

    console.log('🚀 이카운트 테스트 OAPILogin 검증 중...');
    
    // 1. Zone ID 얻기
    const zoneRes = await axios.post('https://sboapi.ecount.com/OAPI/V2/Zone', { COM_CODE });
    const zoneId = zoneRes.data.Data.ZONE;

    // 2. 로그인 (정식 API 로 로그인해서 세션 ID 받기? 과거 스크립트는 이 방식으로 세션을 받았을 수 있음)
    // 과거 스크립트가 성공했던 건 PRODUCTION_KEY 로 로그인해서 세션을 받은 뒤 sboapi 로 호출했을 수 있습니다.
    const PROD_KEY = '3d5709ae9fda24e61b3c271f911eef85b2';
    const loginRes = await axios.post(`https://oapi${zoneId}.ecount.com/OAPI/V2/OAPILogin`, {
      COM_CODE, USER_ID, API_CERT_KEY: PROD_KEY, LAN_TYPE: 'ko-KR', ZONE: zoneId
    });
    
    console.log('Login 응답 Status:', loginRes.status);
    const loginData = loginRes.data;
    
    if (!loginData.Data?.Datas?.SESSION_ID) {
      console.log('세션 획득 실패:', JSON.stringify(loginData));
      return;
    }
    
    const sessionId = loginData.Data.Datas.SESSION_ID;
    console.log('✅ 세션 발급 완료:', sessionId);

    // 3. 테스트 서버(sboapi)에 실데이터 쏴서 검증 통과하기!
    console.log('\n[2] 품목조회 API 검증 호출 중... (/OAPI/V2/InventoryBasic/GetBasicProductsList)');
    const url = `https://sboapi${zoneId}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;
    
    try {
      const apiRes = await axios.post(url, { "PROD_CD": "" });
      console.log('품목조회 응답 Status:', apiRes.status);
      console.log('   --> 결과 (HTTP 200 - 비즈니스 검증단 도달 완료!):', JSON.stringify(apiRes.data).substring(0, 200));
    } catch(e) {
      console.log('품목조회 실패 Status:', e.response?.status);
      console.log('   --> 결과 (에러):', JSON.stringify(e.response?.data));
    }

    console.log('\n=================================');
    console.log('🎉 테스트 API 검증 요청 완료');
    console.log('=================================');

  } catch(e) {
    console.log('치명적 에러:', e.message);
  }
}

testProductsVerification();
