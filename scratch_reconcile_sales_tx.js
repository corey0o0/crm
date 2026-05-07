/**
 * 판매현황 ↔ 입출고(transactions) 불일치 분석 스크립트
 * 
 * 판매현황 기준:
 *   - shipments (status = '출고완료') → transactions.group_id = shipment.id (UUID)
 *   - services  (status = '출고완료') → transactions.group_id = service.id  (숫자)
 * 
 * 분석 항목:
 *   1. 판매현황에는 있지만 transactions에 없는 건
 *   2. transactions에는 있지만 판매현황에 없는 건
 *   3. 동일 group_id에서 부품 종류/수량이 다른 건
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fextlagqverlrajlmkon.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc2MTA5OCwiZXhwIjoyMDU2MzM3MDk4fQ.lVnEzdCfKvQdge8Ywfje33Ab10kcN8jL7_K9XLi0KuI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== 판매현황 ↔ 입출고 불일치 분석 ===\n');

  // 1. 출고완료 shipments 전체 조회
  const { data: shipments, error: shipErr } = await supabase
    .from('shipments')
    .select('id, customer_name, order_date, status, shipment_parts(id, part_name, part_code, quantity)')
    .in('status', ['출고완료', '완료'])
    .order('order_date', { ascending: false });
  if (shipErr) { console.error('shipments 조회 오류:', shipErr.message); return; }

  // 2. 출고완료 services 전체 조회
  const { data: services, error: svcErr } = await supabase
    .from('services')
    .select('id, customer_name, completion_date, status, service_parts(id, part_id, quantity, usage, parts(name, code))')
    .in('status', ['출고완료', '완료'])
    .order('completion_date', { ascending: false });
  if (svcErr) { console.error('services 조회 오류:', svcErr.message); return; }

  // 3. 관련 transactions 전체 조회 (out 타입만, group_id 기준)
  const shipIds = (shipments || []).map(s => String(s.id));
  const svcIds  = (services  || []).map(s => String(s.id));
  const allGroupIds = [...shipIds, ...svcIds];

  console.log(`판매현황 - 매장출고: ${shipIds.length}건, A/S: ${svcIds.length}건`);

  // 청크로 나눠서 조회 (Supabase 필터 한계 대비)
  const txMap = {}; // group_id → [{ product_id, product_name, product_code, quantity }]
  const chunkSize = 100;
  for (let i = 0; i < allGroupIds.length; i += chunkSize) {
    const chunk = allGroupIds.slice(i, i + chunkSize);
    const { data: txs, error: txErr } = await supabase
      .from('transactions')
      .select('group_id, product_id, product_name, product_code, quantity, type')
      .in('group_id', chunk)
      .eq('type', 'out');
    if (txErr) { console.error('transactions 조회 오류:', txErr.message); continue; }
    (txs || []).forEach(tx => {
      const gid = String(tx.group_id);
      if (!txMap[gid]) txMap[gid] = [];
      txMap[gid].push(tx);
    });
  }

  console.log(`입출고(out) 그룹 수: ${Object.keys(txMap).length}건\n`);

  // ── 분석 1: 판매현황에 있지만 transactions에 없는 건 ──
  const missingTx = [];
  for (const ship of (shipments || [])) {
    const gid = String(ship.id);
    const parts = ship.shipment_parts || [];
    const activeParts = parts.filter(p => {
      // 반품 완료된 것은 제외
      return !(p.note && (p.note.includes('[반품완료]')));
    });
    if (activeParts.length === 0) continue; // 부품 없으면 스킵
    if (!txMap[gid] || txMap[gid].length === 0) {
      missingTx.push({
        type: '매장출고',
        id: ship.id,
        customer: ship.customer_name,
        date: ship.order_date?.slice(0, 10),
        parts: activeParts.map(p => `${p.part_name}(${p.quantity})`).join(', ')
      });
    }
  }

  for (const svc of (services || [])) {
    const gid = String(svc.id);
    const parts = (svc.service_parts || []).filter(sp => {
      // 반품완료 제외
      return !(sp.usage && sp.usage.includes('[반품완료]'));
    });
    if (parts.length === 0) continue;
    if (!txMap[gid] || txMap[gid].length === 0) {
      missingTx.push({
        type: 'A/S',
        id: svc.id,
        customer: svc.customer_name,
        date: svc.completion_date?.slice(0, 10),
        parts: parts.map(p => `${p.parts?.name || '?'}(${p.quantity})`).join(', ')
      });
    }
  }

  console.log(`\n[1] 판매현황에는 있지만 입출고 기록이 없는 건: ${missingTx.length}건`);
  if (missingTx.length > 0) {
    missingTx.slice(0, 30).forEach(m => {
      console.log(`  - [${m.type}] ID:${m.id} | ${m.customer} | ${m.date} | ${m.parts}`);
    });
    if (missingTx.length > 30) console.log(`  ... 외 ${missingTx.length - 30}건`);
  }

  // ── 분석 2: 수량 불일치 건 ──
  const mismatch = [];

  for (const ship of (shipments || [])) {
    const gid = String(ship.id);
    if (!txMap[gid]) continue;

    const parts = (ship.shipment_parts || []).filter(p => {
      let rQty = 0;
      if (p.note && p.note.includes('[반품완료]')) return false; // 전체 반품 제외
      if (p.note) {
        const matches = p.note.match(/\[부분반품:(\d+)개\]/g);
        if (matches) matches.forEach(m => { const q = m.match(/\[부분반품:(\d+)개\]/); if (q) rQty += parseInt(q[1]); });
      }
      return (p.quantity - rQty) > 0;
    });

    const salesTotal = parts.reduce((s, p) => {
      let rQty = 0;
      if (p.note) {
        const matches = p.note.match(/\[부분반품:(\d+)개\]/g);
        if (matches) matches.forEach(m => { const q = m.match(/\[부분반품:(\d+)개\]/); if (q) rQty += parseInt(q[1]); });
      }
      return s + (p.quantity - rQty);
    }, 0);

    const txTotal = txMap[gid].reduce((s, t) => s + (t.quantity || 0), 0);

    if (salesTotal !== txTotal) {
      mismatch.push({
        type: '매장출고',
        id: ship.id,
        customer: ship.customer_name,
        date: ship.order_date?.slice(0, 10),
        salesQty: salesTotal,
        txQty: txTotal,
        diff: salesTotal - txTotal,
        parts: parts.map(p => p.part_name).join(', ')
      });
    }
  }

  for (const svc of (services || [])) {
    const gid = String(svc.id);
    if (!txMap[gid]) continue;

    const parts = (svc.service_parts || []).filter(sp => {
      if (sp.usage && sp.usage.includes('[반품완료]')) return false;
      return true;
    });

    const salesTotal = parts.reduce((s, sp) => {
      let rQty = 0;
      if (sp.usage) {
        const matches = sp.usage.match(/\[부분반품:(\d+)개\]/g);
        if (matches) matches.forEach(m => { const q = m.match(/\[부분반품:(\d+)개\]/); if (q) rQty += parseInt(q[1]); });
      }
      return s + Math.max(0, (sp.quantity || 0) - rQty);
    }, 0);

    const txTotal = txMap[gid].reduce((s, t) => s + (t.quantity || 0), 0);

    if (salesTotal !== txTotal) {
      mismatch.push({
        type: 'A/S',
        id: svc.id,
        customer: svc.customer_name,
        date: svc.completion_date?.slice(0, 10),
        salesQty: salesTotal,
        txQty: txTotal,
        diff: salesTotal - txTotal,
        parts: parts.map(p => p.parts?.name || '?').join(', ')
      });
    }
  }

  console.log(`\n[2] 판매현황↔입출고 수량 불일치 건: ${mismatch.length}건`);
  if (mismatch.length > 0) {
    mismatch.slice(0, 30).forEach(m => {
      console.log(`  - [${m.type}] ID:${m.id} | ${m.customer} | ${m.date} | 판매수량:${m.salesQty} vs TX수량:${m.txQty} (차이:${m.diff}) | ${m.parts}`);
    });
    if (mismatch.length > 30) console.log(`  ... 외 ${mismatch.length - 30}건`);
  }

  // ── 분석 3: transactions에는 있지만 판매현황에 없는 group_id ──
  const salesGroupIds = new Set([...shipIds, ...svcIds]);
  const orphanTxGroups = Object.keys(txMap).filter(gid => !salesGroupIds.has(gid));

  console.log(`\n[3] 입출고에는 있지만 판매현황에 없는 group_id: ${orphanTxGroups.length}건`);
  if (orphanTxGroups.length > 0) {
    orphanTxGroups.slice(0, 20).forEach(gid => {
      const txs = txMap[gid];
      console.log(`  - group_id:${gid} | TX건수:${txs.length} | ${txs.map(t => `${t.product_name}(${t.quantity})`).join(', ')}`);
    });
    if (orphanTxGroups.length > 20) console.log(`  ... 외 ${orphanTxGroups.length - 20}건`);
  }

  // ── 요약 ──
  console.log('\n======== 요약 ========');
  console.log(`총 매장출고(출고완료): ${shipIds.length}건`);
  console.log(`총 A/S(출고완료):      ${svcIds.length}건`);
  console.log(`입출고 기록 없는 건:   ${missingTx.length}건`);
  console.log(`수량 불일치 건:        ${mismatch.length}건`);
  console.log(`고아 TX 그룹:          ${orphanTxGroups.length}건`);

  // ── 전체 불일치 목록 JSON 저장 ──
  const report = { missingTx, mismatch, orphanTxGroups: orphanTxGroups.slice(0, 100) };
  import('fs').then(fs => {
    fs.writeFileSync('./scratch_reconcile_report.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('\n결과가 scratch_reconcile_report.json 에 저장되었습니다.');
  });
}

main().catch(console.error);
