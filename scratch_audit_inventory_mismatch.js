const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("Fetching all transactions...");
  const { data: txs, error: txErr } = await supabase.from('transactions').select('*');
  if (txErr) return console.error("TX Error:", txErr);
  
  // Create a map of transactions by group_id
  const txByGroupId = {};
  txs.forEach(tx => {
    if (!tx.group_id) return;
    const gId = String(tx.group_id);
    if (!txByGroupId[gId]) txByGroupId[gId] = [];
    txByGroupId[gId].push(tx);
  });

  console.log("Fetching shipments (출고완료)...");
  const { data: shipments, error: sErr } = await supabase.from('shipments').select('id, status').eq('status', '출고완료');
  if (sErr) return console.error("Shipment Error:", sErr);
  
  console.log("Fetching shipment_parts...");
  const { data: shipParts, error: spErr } = await supabase.from('shipment_parts').select('shipment_id, quantity, part_name');
  if (spErr) return console.error("Shipment Parts Error:", spErr);

  const shipPartsByShipmentId = {};
  shipParts.forEach(sp => {
    if (!shipPartsByShipmentId[sp.shipment_id]) shipPartsByShipmentId[sp.shipment_id] = [];
    shipPartsByShipmentId[sp.shipment_id].push(sp);
  });

  console.log("Fetching services (완료, 처리중)...");
  const { data: services, error: srvErr } = await supabase.from('services').select('id, status').in('status', ['완료', '처리중']);
  if (srvErr) return console.error("Service Error:", srvErr);

  const { data: srvParts, error: srvpErr } = await supabase.from('service_parts').select('service_id, quantity, parts(name)');
  if (srvpErr) return console.error("Service Parts Error:", srvpErr);

  const srvPartsByServiceId = {};
  srvParts.forEach(sp => {
    if (!srvPartsByServiceId[sp.service_id]) srvPartsByServiceId[sp.service_id] = [];
    srvPartsByServiceId[sp.service_id].push(sp);
  });

  console.log("\n==== AUDIT RESULTS ====\n");
  
  let mismatchCount = 0;

  // Audit Shipments
  console.log("--- 1. 출고 (Shipments) 검증 ---");
  shipments.forEach(ship => {
    const sId = String(ship.id);
    const requiredParts = shipPartsByShipmentId[ship.id] || [];
    const txRecords = txByGroupId[sId] || [];
    
    // Sum required quantities
    const totalRequired = requiredParts.reduce((sum, p) => sum + p.quantity, 0);
    // Sum out transactions (assuming shipments deduct inventory: type 'out')
    // Wait, reverting inventory means 'in'. So net quantity out = out - in
    let netTxOut = 0;
    txRecords.forEach(tx => {
      if (tx.type === 'out') netTxOut += tx.quantity;
      if (tx.type === 'in') netTxOut -= tx.quantity;
    });

    if (totalRequired !== netTxOut) {
      mismatchCount++;
      console.log(`[불일치] 출고 ID: ${sId}`);
      console.log(`   필요 차감량: ${totalRequired}`);
      console.log(`   실제 차감량: ${netTxOut}`);
      console.log(`   부품: ${requiredParts.map(p => p.part_name).join(', ')}`);
      console.log(`   트랜잭션 건수: ${txRecords.length}\n`);
    }
  });

  // Audit Services
  console.log("--- 2. A/S (Services) 검증 ---");
  services.forEach(srv => {
    const sId = String(srv.id);
    const requiredParts = srvPartsByServiceId[srv.id] || [];
    const txRecords = txByGroupId[sId] || [];
    
    const totalRequired = requiredParts.reduce((sum, p) => sum + p.quantity, 0);
    let netTxOut = 0;
    txRecords.forEach(tx => {
      if (tx.type === 'out') netTxOut += tx.quantity;
      if (tx.type === 'in') netTxOut -= tx.quantity;
    });

    if (totalRequired !== netTxOut) {
      mismatchCount++;
      console.log(`[불일치] A/S ID: ${sId}`);
      console.log(`   상태: ${srv.status}`);
      console.log(`   필요 차감량: ${totalRequired}`);
      console.log(`   실제 차감량: ${netTxOut}`);
      console.log(`   부품: ${requiredParts.map(p => p.parts?.name || 'Unknown').join(', ')}`);
      console.log(`   트랜잭션 건수: ${txRecords.length}\n`);
    }
  });

  console.log(`==== 검증 완료: 총 ${mismatchCount} 건 불일치 발견 ====`);
}

runAudit();
