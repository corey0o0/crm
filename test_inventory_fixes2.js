const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("=== 테스트 1: RPC 동시성 제어 (Race Condition 방지) 테스트 ===");
  const testPartId = 1; 
  const testWhId = 'W001';

  const { data: inv1 } = await supabase.from('inventory').select('quantity').eq('product_id', testPartId).eq('warehouse_id', testWhId).maybeSingle();
  const initialQty = inv1 ? inv1.quantity : 0;
  console.log(`현재 재고: ${initialQty}`);

  const promises = [];
  for(let i = 0; i < 5; i++) {
    promises.push(supabase.rpc('adjust_inventory', {
      p_warehouse_id: testWhId,
      p_product_id: testPartId,
      p_quantity_change: -1
    }));
  }
  const results = await Promise.all(promises);
  results.forEach((r, idx) => {
    if (r.error) console.log(`RPC Error ${idx}:`, r.error.message);
  });

  const { data: inv2 } = await supabase.from('inventory').select('quantity').eq('product_id', testPartId).eq('warehouse_id', testWhId).maybeSingle();
  const finalQty = inv2 ? inv2.quantity : 0;
  console.log(`동시 차감 후 재고: ${finalQty}`);
  if (initialQty - 5 === finalQty) {
    console.log("✅ [성공] Race Condition 없이 정확하게 5개가 차감되었습니다.\n");
  } else {
    console.log("❌ [실패] 재고 연산 오류!\n");
  }

  // Restore
  await supabase.rpc('adjust_inventory', { p_warehouse_id: testWhId, p_product_id: testPartId, p_quantity_change: 5 });

  console.log("=== 테스트 2: A/S Delta Sync (group_id TEXT) 테스트 ===");
  const testSrvId = '9999999'; // Just use a string ID
  
  const { error: txErr } = await supabase.from('transactions').insert({
    group_id: testSrvId,
    type: 'out',
    product_id: testPartId,
    product_name: '테스트부품',
    product_code: 'TEST',
    quantity: 2,
    date: new Date().toISOString().split('T')[0],
    note: '[A/S 완료] 테스트'
  });

  if (txErr) {
    console.log(`❌ [실패] 트랜잭션 삽입 에러: ${txErr.message}\n`);
  } else {
    console.log(`✅ [성공] 숫자형태 문자열 ID(${testSrvId}) 정상 삽입됨.`);
    const { data: txQuery } = await supabase.from('transactions').select('*').eq('group_id', testSrvId);
    if (txQuery && txQuery.length > 0) {
      console.log(`✅ [성공] 문자열 타입으로 정상 조회됨. (Delta Sync 조회 가능)\n`);
    } else {
      console.log(`❌ [실패] 조회 안됨!\n`);
    }
  }

  console.log("=== 테스트 3: UUID 형태 group_id 삽입 테스트 ===");
  const testUUID = '123e4567-e89b-12d3-a456-426614174000';
  const { error: uuidErr } = await supabase.from('transactions').insert({
    group_id: testUUID,
    type: 'out',
    product_id: testPartId,
    product_name: '테스트부품_UUID',
    product_code: 'TEST_UUID',
    quantity: 1,
    date: new Date().toISOString().split('T')[0],
    note: '[빠른판매] 테스트'
  });

  if (uuidErr) {
    console.log(`❌ [실패] UUID 삽입 에러: ${uuidErr.message}\n`);
  } else {
    console.log(`✅ [성공] UUID 형태 문자열 그룹아이디 정상 저장됨.\n`);
  }

  await supabase.from('transactions').delete().in('group_id', [testSrvId, testUUID]);
  console.log("✅ 테스트 종료");
}
runTests();
