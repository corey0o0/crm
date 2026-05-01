const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAll(table, selectQuery = '*') {
  let allData = [];
  let start = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(selectQuery).range(start, start + limit - 1);
    if (error) { console.error(`Error fetching ${table}:`, error); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < limit) break;
    start += limit;
  }
  return allData;
}

async function audit() {
  console.log('=== SYSTEM AUDIT START ===\n');

  // 1. Fetch ALL transactions
  const trans = await fetchAll('transactions');
  console.log(`Total transactions fetched: ${trans.length}`);

  // 2. CAFE24 ORDERS AUDIT
  const { data: cOrders } = await supabase.from('cafe24_orders').select('order_id, order_items').eq('is_transferred', true);
  console.log(`\n[Cafe24 Orders Audit] Total transferred orders: ${cOrders.length}`);
  
  let cDiscrepancy = 0;
  for (const o of cOrders) {
    const oTrans = trans.filter(t => t.note && t.note.includes(`주문: ${o.order_id}`));
    
    const itemQty = {};
    if (o.order_items) {
      o.order_items.forEach(i => {
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(i.order_status);
        if (isCancelled || !i.part_id) return;
        itemQty[i.part_id] = (itemQty[i.part_id] || 0) + Number(i.quantity);
      });
    }
    
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
    if (mismatch) {
      // It's possible the order has no transactions because it was entirely "개인결제건" (part_id null)
      if (Object.keys(itemQty).length === 0 && Object.keys(transQty).length === 0) {
        mismatch = false;
      }
    }
    if (mismatch) {
      cDiscrepancy++;
      console.log(`Mismatch: ${o.order_id}`);
    }
  }
  console.log(`Cafe24 Orders Discrepancies: ${cDiscrepancy}`);

  // 3. AS RECORDS AUDIT
  const asRecords = await fetchAll('as_history', 'id, as_parts(part_id, quantity)');
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
    if (mismatch && aTrans.length > 0) asDiscrepancy++;
  }
  console.log(`A/S Records Discrepancies (where trans exist): ${asDiscrepancy}`);

  console.log('\n=== SYSTEM AUDIT END ===');
}

audit();
