const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  console.log('=== SYSTEM AUDIT START ===\n');

  // 1. Fetch ALL transactions
  const { data: trans } = await supabase.from('transactions').select('*');
  console.log(`Total transactions found: ${trans.length}`);

  // 2. CAFE24 ORDERS AUDIT
  const { data: cOrders } = await supabase.from('cafe24_orders').select('order_id, order_items').eq('is_transferred', true);
  console.log(`\n[Cafe24 Orders Audit] Total transferred orders: ${cOrders.length}`);
  
  let cDiscrepancy = 0;
  for (const o of cOrders) {
    const oTrans = trans.filter(t => t.note && t.note.includes(`주문: ${o.order_id}`));
    
    // Sum qty per part_id in order
    const itemQty = {};
    o.order_items.forEach(i => {
      const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(i.order_status);
      if (isCancelled || !i.part_id) return;
      itemQty[i.part_id] = (itemQty[i.part_id] || 0) + Number(i.quantity);
    });
    
    // Sum qty per product_id in trans
    const transQty = {};
    oTrans.forEach(t => {
      if (!t.product_id) return;
      transQty[t.product_id] = (transQty[t.product_id] || 0) + Number(t.quantity);
    });
    
    let mismatch = false;
    for (const [pid, qty] of Object.entries(itemQty)) {
      if (transQty[pid] !== qty) mismatch = true;
    }
    for (const [pid, qty] of Object.entries(transQty)) {
      if (itemQty[pid] !== qty) mismatch = true;
    }
    if (mismatch) cDiscrepancy++;
  }
  console.log(`Cafe24 Orders Discrepancies: ${cDiscrepancy}`);

  // 3. SHIPMENTS (Ecount / B2B) AUDIT
  const { data: shipments } = await supabase.from('shipments').select('id, status, shipment_parts(part_name, part_code, quantity)');
  const completedShipments = shipments.filter(s => s.status === '출고완료');
  console.log(`\n[Shipments Audit] Total completed shipments: ${completedShipments.length}`);
  
  let sDiscrepancy = 0;
  // Note: Old Ecount migrations have note "[과거 이카운트 이관]" and might NOT have transactions
  // Or maybe they DO? Let's see if shipments create transactions.
  for (const s of completedShipments) {
    const sTrans = trans.filter(t => t.group_id === `SHIP-${s.id}`);
    
    // Not all shipments have group_id tracked perfectly, especially legacy ones.
    // If it's a legacy shipment without trans, we can skip or log.
  }

  // 4. AS RECORDS AUDIT
  const { data: asRecords } = await supabase.from('as_records').select('id, as_parts(part_id, quantity)');
  console.log(`\n[AS Records Audit] Total A/S records: ${asRecords.length}`);
  let asDiscrepancy = 0;
  for (const a of asRecords) {
    if (!a.as_parts || a.as_parts.length === 0) continue;
    const aTrans = trans.filter(t => t.group_id === `AS-${a.id}`);
    
    const partQty = {};
    a.as_parts.forEach(p => {
      if (!p.part_id) return;
      partQty[p.part_id] = (partQty[p.part_id] || 0) + Number(p.quantity);
    });
    
    const tQty = {};
    aTrans.forEach(t => {
      if (!t.product_id) return;
      if (t.type === 'in') {
        tQty[t.product_id] = (tQty[t.product_id] || 0) - Number(t.quantity);
      } else {
        tQty[t.product_id] = (tQty[t.product_id] || 0) + Number(t.quantity);
      }
    });
    
    let mismatch = false;
    for (const [pid, qty] of Object.entries(partQty)) {
      if (qty > 0 && tQty[pid] !== qty) mismatch = true;
    }
    if (mismatch && aTrans.length > 0) asDiscrepancy++; // Only count if there were some transactions but mismatched
  }
  console.log(`A/S Records Discrepancies (where trans exist): ${asDiscrepancy}`);
  
  console.log('\n=== SYSTEM AUDIT END ===');
}

audit();
