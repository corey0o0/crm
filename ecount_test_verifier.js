const axios = require('axios');

async function testAllApis() {
  try {
    const COM_CODE = '678204';
    const TEST_KEY = '374cb9bc9186d4234a183c0a470302ad32';
    const USER_ID = 'slimpack';

    console.log('🚀 이카운트 테스트 OAPILogin 검증 중...');
    const zoneRes = await axios.post('https://sboapi.ecount.com/OAPI/V2/Zone', { COM_CODE });
    const zoneId = zoneRes.data.Data.ZONE;

    const loginRes = await axios.post(`https://sboapi${zoneId}.ecount.com/OAPI/V2/OAPILogin`, {
      COM_CODE, USER_ID, API_CERT_KEY: TEST_KEY, LAN_TYPE: 'ko-KR', ZONE: zoneId
    });
    
    if (!loginRes.data.Data?.Datas?.SESSION_ID) {
      console.log('로그인 실패 API Key 만료됨?');
      return;
    }
    const sessionId = loginRes.data.Data.Datas.SESSION_ID;

    // 3. 테스트 대상
    const testApis = [
      {
        name: '오픈마켓주문입력 API',
        path: '/OAPI/V2/OpenMarket/SaveOpenMarketOrderNew',
        payload: {
          "OPENMARKET_CD": "00001",
          "ORDERS": [{
            "GROUP_NO": "123",
            "ORDER_NO": "123",
            "ORDER_DATE": "2023-01-01 10:00:00.000",
            "PAY_DATE": "2023-01-01 10:00:00.000",
            "PROD_CD": "00001",
            "PROD_NM": "TEST",
            "PROD_OPT": "",
            "ORDER_QTY": 1,
            "ORDER_AMT": 1000,
            "ORDERER": "TEST",
            "ORDERER_TEL": "010-0000-0000",
            "RECEIVER": "TEST",
            "RECEIVER_TEL": "010-0000-0000",
            "ADDR": "TEST",
            "SHOP_NM": "TEST"
          }]
        }
      }
    ];

    for (let api of testApis) {
       console.log(`\n▶️ [${api.name}] 테스트... (${api.path})`);
       const url = `https://sboapi${zoneId}.ecount.com${api.path}?SESSION_ID=${sessionId}`;
       try {
         const apiRes = await axios.post(url, api.payload);
         const resStr = JSON.stringify(apiRes.data);
         if (!resStr.includes('Not Found') && !resStr.includes('No HTTP resource')) {
             console.log(`   ✅ 정답 통과! (HTTP 200 - 비즈니스단 에러/성공 완료!)`);
             console.log(`   응답: ${resStr.substring(0, 150)}`);
         } else {
             console.log(`   ❌ 실패 (경로 불일치): ${resStr.substring(0, 100)}`);
         }
       } catch(e) {
         const errStr = JSON.stringify(e.response?.data);
         if (!errStr?.includes('Not Found') && !errStr?.includes('No HTTP resource')) {
             console.log(`   ✅ 정답 통과! (HTTP ${e.response?.status} - 인증 또는 입출력단 에러, 검증 통과)`);
             console.log(`   에러: ${errStr?.substring(0, 150)}`);
         } else {
             console.log(`   ❌ 실패 (경로 불일치): ${errStr?.substring(0, 100)}`);
         }
       }
    }

  } catch(e) {
    console.log('치명적 에러:', e.message);
  }
}

testAllApis();
