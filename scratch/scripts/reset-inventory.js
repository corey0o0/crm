/**
 * 재고 0 초기화 스크립트 (v2)
 * - inventory 테이블에 모든 창고×상품 조합을 quantity=0으로 upsert
 * - parts 테이블의 stock도 0으로 설정
 * - 기존 inventory 레코드를 모두 삭제 후 재생성
 *
 * 실행: node scripts/reset-inventory.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fextlagqverlrajlmkon.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetInventory() {
  console.log('=== 재고 0 초기화 스크립트 (v2) ===\n');

  // 1. 모든 창고 조회
  console.log('1단계: 창고 목록 조회...');
  const { data: warehouses, error: whErr } = await supabase
    .from('warehouses')
    .select('id, name');
  if (whErr) { console.error('창고 조회 오류:', whErr.message); process.exit(1); }
  console.log(`  → ${warehouses.length}개 창고 발견: ${warehouses.map(w => w.name).join(', ')}`);

  // 2. 모든 상품 조회
  console.log('\n2단계: 상품 목록 조회...');
  const { data: parts, error: partErr } = await supabase
    .from('parts')
    .select('id, name, code, stock');
  if (partErr) { console.error('상품 조회 오류:', partErr.message); process.exit(1); }
  console.log(`  → ${parts.length}개 상품 발견`);

  // 3. 기존 inventory 레코드 전체 삭제
  console.log('\n3단계: 기존 inventory 레코드 삭제...');
  const { error: delErr } = await supabase
    .from('inventory')
    .delete()
    .not('warehouse_id', 'is', null);
  if (delErr) {
    console.error('inventory 삭제 오류:', delErr.message);
    // 삭제 실패해도 upsert로 진행
  } else {
    console.log('  → 기존 레코드 삭제 완료');
  }

  // 4. 모든 창고×상품 조합을 quantity=0으로 upsert
  console.log('\n4단계: 모든 창고×상품 조합을 quantity=0으로 생성...');
  const now = new Date().toISOString();
  const upsertRows = [];
  for (const w of warehouses) {
    for (const p of parts) {
      upsertRows.push({
        warehouse_id: w.id,
        product_id: p.id,
        quantity: 0,
        updated_at: now
      });
    }
  }
  console.log(`  → ${upsertRows.length}개 레코드 생성 예정 (${warehouses.length}개 창고 × ${parts.length}개 상품)`);

  // 배치로 나누어 upsert (한번에 500개씩)
  const BATCH_SIZE = 500;
  let totalInserted = 0;
  for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
    const batch = upsertRows.slice(i, i + BATCH_SIZE);
    const { data, error: upErr } = await supabase
      .from('inventory')
      .upsert(batch, { onConflict: 'warehouse_id,product_id' })
      .select('id');

    if (upErr) {
      console.error(`  ✗ 배치 ${Math.floor(i / BATCH_SIZE) + 1} upsert 오류:`, upErr.message);
    } else {
      totalInserted += (data || []).length;
      console.log(`  ✓ 배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${(data || []).length}개 처리`);
    }
  }
  console.log(`  → 총 ${totalInserted}개 inventory 레코드 생성/업데이트 완료`);

  // 5. parts.stock도 0으로 설정
  console.log('\n5단계: parts.stock 0으로 업데이트...');
  const partsWithStock = parts.filter(p => p.stock && p.stock !== 0);
  if (partsWithStock.length > 0) {
    let pSuccess = 0;
    for (const p of partsWithStock) {
      const { error } = await supabase.from('parts').update({ stock: 0 }).eq('id', p.id);
      if (!error) pSuccess++;
    }
    console.log(`  → ${pSuccess}/${partsWithStock.length}건 완료`);
  } else {
    console.log('  → parts.stock이 이미 모두 0입니다.');
  }

  // 6. 결과 확인
  console.log('\n=== 초기화 완료 ===');
  console.log(`  inventory 테이블: ${totalInserted}건 (모두 quantity=0)`);
  console.log('\n브라우저에서 "새로고침" 버튼을 눌러주세요!');
}

resetInventory().catch(err => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
