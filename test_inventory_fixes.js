const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// We need to import the actual functions, but we are running in Node, not React.
// Let's simulate the logic directly since we can't easily import ES modules in this basic node script without setup.
// We will test the DB layers directly: RPC and transactions table.

async function runTests() {
  console.log("=== 테스트 1: RPC 동시성 제어 (Race Condition 방지) 테스트 ===");
  // Test part ID
  const testPartId = 1; // Assuming part 1 exists
  const testWhId = 'W001';

  // 1. Get current inventory
  const { data: inv1 } = await supabase.from('inventory').select('quantity').eq('product_id', testPartId).eq('warehouse_id', testWhId).single();
  const initialQty = inv1 ? inv1.quantity : 0;
  console.log(`현재 재고: ${initialQty}`);

  // 2. Fire 5 concurrent RPC calls to deduct 1 each
  console.log("5개의 동시 차감 요청(-1)을 발생시킵니다...");
  const promises = [];
  for(let i = 0; i < 5; i++) {
    promises.push(supabase.rpc('adjust_inventory', {
      p_warehouse_id: testWhId,
      p_product_id: testPartId,
      p_quantity_change: -1
    }));
  }
  await Promise.all(promises);

  // 3. Get new inventory
  const { data: inv2 } = await supabase.from('inventory').select('quantity').eq('product_id', testPartId).eq('warehouse_id', testWhId).single();
  const finalQty = inv2 ? inv2.quantity : 0;
  console.log(`동시 차감 후 재고: ${finalQty}`);
  if (initialQty - 5 === finalQty) {
    console.log("✅ [성공] Race Condition 없이 정확하게 5개가 차감되었습니다.\n");
  } else {
    console.log("❌ [실패] 재고 오염 발생!\n");
  }

  console.log("=== 테스트 2: A/S Delta Sync 무한 차감 방지 테스트 (group_id TEXT 확인) ===");
  // Create a dummy service
  const { data: srv } = await supabase.from('services').insert({
    customer_name: '테스트유저',
    phone: '010-0000-0000',
    status: '완료'
  }).select('id').single();
  const testSrvId = srv.id;

  // Insert a transaction with group_id = testSrvId
  const { error: txErr } = await supabase.from('transactions').insert({
    group_id: String(testSrvId), // This should succeed now since group_id is TEXT
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
    console.log(`✅ [성공] 숫자형 ID(${testSrvId})를 문자열로 변환하여 트랜잭션에 정상 삽입되었습니다.`);
    
    // Now test if we can query it using string
    const { data: txQuery } = await supabase.from('transactions').select('*').eq('group_id', String(testSrvId));
    if (txQuery && txQuery.length > 0) {
      console.log(`✅ [성공] 문자열 타입으로 정상 조회됩니다. (Delta Sync 조회 가능)\n`);
    } else {
      console.log(`❌ [실패] 데이터가 조회되지 않습니다.\n`);
    }
  }

  console.log("=== 테스트 3: SalesEntry (UUID) 삽입 테스트 ===");
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
    console.log(`❌ [실패] UUID 트랜잭션 삽입 에러: ${uuidErr.message}\n`);
  } else {
    console.log(`✅ [성공] UUID 형태의 문자열도 group_id에 정상적으로 저장됩니다.\n`);
  }

  // Cleanup testing data
  console.log("테스트 데이터를 복구합니다...");
  await supabase.rpc('adjust_inventory', { p_warehouse_id: testWhId, p_product_id: testPartId, p_quantity_change: 5 });
  await supabase.from('transactions').delete().in('group_id', [String(testSrvId), testUUID]);
  await supabase.from('services').delete().eq('id', testSrvId);
  console.log("✅ 테스트 완료 및 복구 끝!");
}

runTests();
