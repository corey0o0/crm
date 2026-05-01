const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const { data: txs, error: txErr } = await supabase.from('transactions').select('*');
  
  // Try to recover orphaned transactions' group_id by parsing the note
  let recoveredCount = 0;
  const txByGroupId = {};
  txs.forEach(tx => {
    let gId = tx.group_id ? String(tx.group_id) : null;
    
    // If orphaned, try to parse from note
    if (!gId && tx.note) {
      const match = tx.note.match(/\(Ref:\s*([a-f0-9\-]{36}|[0-9]+)\)/i);
      if (match && match[1]) {
        gId = match[1];
        recoveredCount++;
      }
    }
    
    if (!gId) return; // Still orphaned
    
    if (!txByGroupId[gId]) txByGroupId[gId] = [];
    txByGroupId[gId].push(tx);
  });

  const { data: shipments } = await supabase.from('shipments').select('id, status').eq('status', '출고완료');
  const { data: shipParts } = await supabase.from('shipment_parts').select('shipment_id, quantity, part_name');

  const shipPartsByShipmentId = {};
  shipParts.forEach(sp => {
    if (!shipPartsByShipmentId[sp.shipment_id]) shipPartsByShipmentId[sp.shipment_id] = [];
    shipPartsByShipmentId[sp.shipment_id].push(sp);
  });

  let mismatchCount = 0;
  let mismatchRecovered = 0;
  
  shipments.forEach(ship => {
    const sId = String(ship.id);
    const requiredParts = shipPartsByShipmentId[ship.id] || [];
    const txRecords = txByGroupId[sId] || [];
    
    const totalRequired = requiredParts.reduce((sum, p) => sum + p.quantity, 0);
    let netTxOut = 0;
    txRecords.forEach(tx => {
      if (tx.type === 'out') netTxOut += tx.quantity;
      if (tx.type === 'in') netTxOut -= tx.quantity;
    });

    if (totalRequired !== netTxOut) {
      mismatchCount++;
    }
  });

  console.log(`Recovered group_ids from notes: ${recoveredCount}`);
  console.log(`Total mismatch count after recovery (Shipments only): ${mismatchCount} out of ${shipments.length}`);
}

runAudit();
