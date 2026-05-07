/**
 * 판매현황 ↔ 입출고 불일치 건 분류 리포트
 * 결과를 CSV로 저장해서 엑셀에서 바로 열 수 있게 함
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://fextlagqverlrajlmkon.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc2MTA5OCwiZXhwIjoyMDU2MzM3MDk4fQ.lVnEzdCfKvQdge8Ywfje33Ab10kcN8jL7_K9XLi0KuI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function escCsv(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  console.log('=== 판매현황 ↔ 입출고 불일치 분류 시작 ===\n');

  // ── 1. 판매현황 데이터 ──────────────────────────────────
  const { data: shipments } = await supabase
    .from('shipments')
    .select('id, customer_name, order_date, status, note, shipment_parts(id, part_name, part_code, quantity, note)')
    .in('status', ['출고완료', '완료'])
    .order('order_date', { ascending: false });

  const { data: services } = await supabase
    .from('services')
    .select('id, customer_name, completion_date, reception_date, status, service_parts(id, part_id, quantity, usage, parts(name, code))')
    .in('status', ['출고완료', '완료'])
    .order('completion_date', { ascending: false });

  // ── 2. 관련 transactions (out) ──────────────────────────
  const shipIds = (shipments || []).map(s => String(s.id));
  const svcIds  = (services  || []).map(s => String(s.id));
  const allGroupIds = [...shipIds, ...svcIds];

  const txMap = {}; // group_id → [tx]
  for (let i = 0; i < allGroupIds.length; i += 100) {
    const chunk = allGroupIds.slice(i, i + 100);
    const { data: txs } = await supabase
      .from('transactions')
      .select('group_id, product_id, product_name, product_code, quantity, type, note')
      .in('group_id', chunk)
      .eq('type', 'out');
    (txs || []).forEach(tx => {
      const gid = String(tx.group_id);
      if (!txMap[gid]) txMap[gid] = [];
      txMap[gid].push(tx);
    });
  }

  console.log(`매장출고: ${shipIds.length}건 / A/S: ${svcIds.length}건`);
  console.log(`입출고 그룹: ${Object.keys(txMap).length}건`);

  // ── 유효 부품 수량 계산 헬퍼 ──────────────────────────
  function getEffectiveQty(qty, noteOrUsage) {
    let rQty = 0;
    if (!noteOrUsage) return qty;
    if (noteOrUsage.includes('[반품완료]')) return 0;
    const matches = noteOrUsage.match(/\[부분반품:(\d+)개\]/g);
    if (matches) matches.forEach(m => {
      const q = m.match(/\[부분반품:(\d+)개\]/);
      if (q) rQty += parseInt(q[1]);
    });
    return Math.max(0, qty - rQty);
  }

  // ── 3. 분류 ────────────────────────────────────────────
  const rows = []; // CSV 행

  // 카테고리:
  // A = TX 없음 (판매현황에만 존재)
  // B = TX 수량 < 판매현황 수량  (TX 부족)
  // C = TX 수량 > 판매현황 수량  (TX 초과)
  // D = 일치 → 제외

  // ── 매장출고 처리 ──
  for (const ship of (shipments || [])) {
    const gid = String(ship.id);
    const activeParts = (ship.shipment_parts || []).filter(p => {
      const eff = getEffectiveQty(p.quantity || 0, p.note);
      return eff > 0;
    });

    // 유효 부품이 없으면 스킵 (전체반품 or 부품없음)
    if (activeParts.length === 0) continue;

    const salesTotal = activeParts.reduce((s, p) => s + getEffectiveQty(p.quantity || 0, p.note), 0);
    const txTotal = (txMap[gid] || []).reduce((s, t) => s + (t.quantity || 0), 0);
    const diff = salesTotal - txTotal;

    if (diff === 0) continue; // 일치 → 제외

    const category = !txMap[gid] || txMap[gid].length === 0 ? 'A (TX없음)' :
                     diff > 0 ? 'B (TX부족)' : 'C (TX초과)';

    const salesPartsStr = activeParts.map(p => {
      const eff = getEffectiveQty(p.quantity || 0, p.note);
      return `${p.part_name || '?'}×${eff}`;
    }).join(' | ');

    const txPartsStr = (txMap[gid] || []).map(t =>
      `${t.product_name || '?'}×${t.quantity}`
    ).join(' | ');

    rows.push({
      분류: category,
      유형: '매장출고',
      ID: ship.id,
      고객명: ship.customer_name || '-',
      날짜: (ship.order_date || '').slice(0, 10),
      판매현황_수량합계: salesTotal,
      TX_수량합계: txTotal,
      차이: diff,
      판매현황_부품목록: salesPartsStr,
      TX_부품목록: txPartsStr,
      링크: `https://crmapp8893.netlify.app/shipment/${ship.id}`,
    });
  }

  // ── A/S 처리 ──
  for (const svc of (services || [])) {
    const gid = String(svc.id);
    const activeParts = (svc.service_parts || []).filter(sp => {
      const eff = getEffectiveQty(sp.quantity || 0, sp.usage);
      return eff > 0;
    });

    if (activeParts.length === 0) continue;

    const salesTotal = activeParts.reduce((s, sp) => s + getEffectiveQty(sp.quantity || 0, sp.usage), 0);
    const txTotal = (txMap[gid] || []).reduce((s, t) => s + (t.quantity || 0), 0);
    const diff = salesTotal - txTotal;

    if (diff === 0) continue; // 일치 → 제외

    const category = !txMap[gid] || txMap[gid].length === 0 ? 'A (TX없음)' :
                     diff > 0 ? 'B (TX부족)' : 'C (TX초과)';

    const salesPartsStr = activeParts.map(sp => {
      const eff = getEffectiveQty(sp.quantity || 0, sp.usage);
      return `${sp.parts?.name || '?'}×${eff}`;
    }).join(' | ');

    const txPartsStr = (txMap[gid] || []).map(t =>
      `${t.product_name || '?'}×${t.quantity}`
    ).join(' | ');

    const dateVal = (svc.completion_date || svc.reception_date || '').slice(0, 10);

    rows.push({
      분류: category,
      유형: 'A/S',
      ID: svc.id,
      고객명: svc.customer_name || '-',
      날짜: dateVal,
      판매현황_수량합계: salesTotal,
      TX_수량합계: txTotal,
      차이: diff,
      판매현황_부품목록: salesPartsStr,
      TX_부품목록: txPartsStr,
      링크: `https://crmapp8893.netlify.app/service/${svc.id}`,
    });
  }

  // 날짜 내림차순 정렬
  rows.sort((a, b) => b.날짜.localeCompare(a.날짜));

  // ── 4. 요약 출력 ──────────────────────────────────────
  const countA_ship = rows.filter(r => r.유형 === '매장출고' && r.분류.startsWith('A')).length;
  const countB_ship = rows.filter(r => r.유형 === '매장출고' && r.분류.startsWith('B')).length;
  const countC_ship = rows.filter(r => r.유형 === '매장출고' && r.분류.startsWith('C')).length;
  const countA_svc  = rows.filter(r => r.유형 === 'A/S' && r.분류.startsWith('A')).length;
  const countB_svc  = rows.filter(r => r.유형 === 'A/S' && r.분류.startsWith('B')).length;
  const countC_svc  = rows.filter(r => r.유형 === 'A/S' && r.분류.startsWith('C')).length;

  console.log('\n─────────────────────────────────────');
  console.log('          불일치 분류 요약');
  console.log('─────────────────────────────────────');
  console.log(`분류 A (TX 없음)  - 매장출고: ${countA_ship}건 / A/S: ${countA_svc}건`);
  console.log(`분류 B (TX 부족)  - 매장출고: ${countB_ship}건 / A/S: ${countB_svc}건`);
  console.log(`분류 C (TX 초과)  - 매장출고: ${countC_ship}건 / A/S: ${countC_svc}건`);
  console.log(`─────────────────────────────────────`);
  console.log(`전체 불일치 건:   ${rows.length}건`);

  // ── 5. CSV 저장 (UTF-8 BOM, 엑셀 호환) ──────────────
  const headers = Object.keys(rows[0] || {});
  const csvLines = [
    '\uFEFF' + headers.map(escCsv).join(','),
    ...rows.map(r => headers.map(h => escCsv(r[h])).join(','))
  ];
  const csvPath = './scratch_mismatch_report.csv';
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`\n✅ CSV 저장 완료: ${csvPath}`);
  console.log('   엑셀에서 바로 열 수 있습니다.');

  // ── 6. JSON 저장 (추후 수정 작업용) ──────────────────
  const jsonPath = './scratch_mismatch_classified.json';
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`✅ JSON 저장 완료: ${jsonPath}`);
}

main().catch(console.error);
