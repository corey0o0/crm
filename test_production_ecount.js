const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

async function verifyProduction() {
  const COM_CODE = process.env.ECOUNT_COM_CODE;
  const USER_ID = process.env.ECOUNT_USER_ID;
  const PROD_KEY = process.env.ECOUNT_API_KEY;

  console.log('🚀 정식 API 인증키 연동 점검 시작...');
  console.log(`COM_CODE: ${COM_CODE}, USER_ID: ${USER_ID}, KEY 설정 확인 완료.`);

  try {
    // 1. Zone ID 얻기
    const zoneRes = await axios.post('https://sboapi.ecount.com/OAPI/V2/Zone', { COM_CODE });
    const zoneId = zoneRes.data.Data.ZONE;
    console.log(`Zone 획득: ${zoneId}`);

    // 2. 로그인 (oapi 로 로그인해서 정식 세션 얻기)
    const loginRes = await axios.post(`https://oapi${zoneId}.ecount.com/OAPI/V2/OAPILogin`, {
      COM_CODE, USER_ID, API_CERT_KEY: PROD_KEY, LAN_TYPE: 'ko-KR', ZONE: zoneId
    });
    
    if (!loginRes.data.Data?.Datas?.SESSION_ID) {
      console.log('❌ 로그인 실패 (인증키 오류 혹은 권한 없음):', JSON.stringify(loginRes.data));
      return;
    }
    
    const sessionId = loginRes.data.Data.Datas.SESSION_ID;
    console.log('✅ 정식 세션 발급 완료 (API 서버 통신 가능)');

    // 3. 테스트 대상 호출: 품목조회 (실서버는 oapi)
    // - 만약 사용자가 이카운트 정식키 설정에서 체크를 하지 않았다면 여기서 실패하게 됩니다.
    const url = `https://oapi${zoneId}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;
    const payload = { "PROD_CD": "" };
    
    console.log(`▶️ 정식 API 호출 테스트: GetBasicProductsList (품목조회)`);
    try {
        const apiRes = await axios.post(url, payload);
        const resData = apiRes.data;
        
        if (resData.Status === '200' && resData.Data) {
            console.log(`🎉 정식 API 호출 완전히 성공! 실제 상품 데이터 ${resData.Data.TotalCnt ?? '다수'}건 조회 결과 도착.`);
            console.log(`응답 요약: ${JSON.stringify(resData.Data).substring(0, 100)}...`);
            console.log(`\n================================`);
            console.log(`🔥 결론: 고객님께서 이카운트 창에서 올바르게 체크(V) 후 저장하셔서 정식키 사용에 아무런 문제가 없음을 확인했습니다!`);
            console.log(`================================`);
        } else {
            console.log(`❌ 정식 호출 거부됨 (혹시 허용메뉴 체크를 빠뜨리셨나요?):`, JSON.stringify(resData));
        }
    } catch(e) {
        console.log(`❌ 정식 호출 실패 (오류 발생): ${e.response?.status} - ${JSON.stringify(e.response?.data) || e.message}`);
    }
    
  } catch (e) {
    console.log(`❌ 시스템 에러: ${e.response?.status} - ${JSON.stringify(e.response?.data) || e.message}`);
  }
}
verifyProduction();
