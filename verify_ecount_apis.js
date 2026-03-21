const axios = require('axios');

const ZONE_URL = 'https://sboapi.ecount.com';
const TEST_KEY = '374cb9bc9186d4234a183c0a470302ad32'; // Test API Key is used as SESSION_ID

const apisToVerify = [
  // 재고현황 조회
  { name: 'Inventory Balance (조회)', path: '/OAPI/V2/InventoryBalance/GetListInventoryBalance', payload: {} },
  // 품목 조회
  { name: 'Product List (조회)', path: '/OAPI/V2/Product/GetListProduct', payload: {} },
  // 주문서 저장
  { name: 'Save Order (저장)', path: '/OAPI/V2/Order/SaveOrder', payload: { OrderList: [] } },
  // 판매(매출) 저장
  { name: 'Save Sale (저장)', path: '/OAPI/V2/Sale/SaveSale', payload: { SaleList: [] } },
];

async function verifyApis() {
  console.log('🚀 이카운트 오픈 API 터미널 검증 스크립트 실행 중...');
  console.log(`사용할 ZONE: ${ZONE_URL}`);
  
  for (const api of apisToVerify) {
    try {
      const url = `${ZONE_URL}${api.path}?SESSION_ID=${TEST_KEY}`;
      console.log(`\n⏳ 검증 요청 중: ${api.name} -> ${api.path}`);
      
      const response = await axios.post(url, api.payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`✅ 응답 도착 (Status: ${response.data.Status})`);
      if (response.data.Errors && response.data.Errors.length > 0) {
        console.log(`   [검증 상태]: 응답 수신 성공! (내용: ${response.data.Errors[0].Message})`);
      } else {
        console.log(`   [검증 상태]: 요청 성공!`);
      }
    } catch (error) {
       console.error(`❌ 네트워크/치명적 오류:`, error.message);
       if (error.response && error.response.data) {
         console.error('   상세:', JSON.stringify(error.response.data));
       }
    }
  }
  
  console.log('\n=================================');
  console.log('🎉 모든 테스트 API 요청 완료!');
  console.log('이카운트 ERP [API 인증현황] 메뉴를 새로고침 해보세요.');
  console.log('=================================');
}

verifyApis();
