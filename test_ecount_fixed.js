const axios = require('axios');

async function testEcount() {
  try {
    const COM_CODE = '678204';
    const TEST_KEY = '374cb9bc9186d4234a183c0a470302ad32';
    const USER_ID = 'SLIMPACK';

    console.log('1. Get Zone...');
    const zoneRes = await axios.post('https://sboapi.ecount.com/OAPI/V2/Zone', { COM_CODE });
    const zoneId = zoneRes.data.Data.ZONE;
    console.log('ZONE:', zoneId);

    console.log('\n2. Login...');
    const loginRes = await axios.post(`https://oapi${zoneId}.ecount.com/OAPI/V2/OAPILogin`, {
      COM_CODE, USER_ID, API_CERT_KEY: TEST_KEY, LAN_TYPE: 'ko-KR', ZONE: zoneId
    });
    
    // Test key might return 204 or a real SESSION_ID
    const loginData = loginRes.data;
    let sessionId = '';
    let isTest = false;

    if (loginData.Data?.Datas?.SESSION_ID) {
      sessionId = loginData.Data.Datas.SESSION_ID;
      console.log('GOT REAL SESSION_ID:', sessionId);
    } else if (loginData.Data?.Code === '204') {
      sessionId = TEST_KEY;
      isTest = true;
      console.log('GOT 204. USING TEST KEY AS SESSION_ID:', sessionId);
    } else {
      console.log('LOGIN FAIL:', JSON.stringify(loginData));
      return;
    }

    console.log('\n3. Test API on SBOAPI...');
    let url = `https://sboapi${zoneId}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;
    try {
      const apiRes = await axios.post(url, {});
      console.log('SUCCESS SBOAPI:', JSON.stringify(apiRes.data).substring(0,200));
    } catch(e) {
      console.log('SBOAPI FAILED:', e.response?.status, JSON.stringify(e.response?.data));
    }

    console.log('\n4. Test API on OAPI...');
    url = `https://oapi${zoneId}.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;
    try {
      const apiRes = await axios.post(url, {});
      console.log('SUCCESS OAPI:', JSON.stringify(apiRes.data).substring(0,200));
    } catch(e) {
      console.log('OAPI FAILED:', e.response?.status, JSON.stringify(e.response?.data));
    }

  } catch(e) {
    console.log('FATAL ERROR:', e.message);
  }
}
testEcount();
