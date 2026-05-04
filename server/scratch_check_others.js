require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function isValidUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function verifyOthers() {
  console.log('Fetching transactions...');
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .not('group_id', 'is', null);

  if (txErr) throw txErr;

  const groups = {};
  for (const tx of txs) {
    if (tx.type !== 'out') continue;
    if (!isValidUUID(tx.group_id)) continue;
    
    // Check if the timestamp is exactly identical to find race conditions,
    // OR just group by product to see if count > items array.
    const key = `${tx.group_id}_${tx.product_id}_${tx.quantity}_${tx.from_location}`;
    if (!groups[key]) {
      groups[key] = { txs: [] };
    }
    groups[key].txs.push(tx);
  }

  const potentialDuplicates = Object.values(groups).filter(g => g.txs.length > 1);
  
  if (potentialDuplicates.length === 0) {
    console.log('No potential duplicates found for UUID group_ids.');
    return;
  }

  const uniqueGroupIds = [...new Set(potentialDuplicates.map(g => g.txs[0].group_id))];
  
  // 1. Check service_records
  const { data: serviceRecords } = await supabase
    .from('service_records')
    .select('id, customer_name, parts_used')
    .in('id', uniqueGroupIds);
    
  const serviceMap = {};
  if (serviceRecords) {
    for (const sr of serviceRecords) serviceMap[sr.id] = sr;
  }
  
  // 2. Check sales_history
  const { data: salesHistory } = await supabase
    .from('sales_history')
    .select('id, customer_name, items')
    .in('id', uniqueGroupIds);
    
  const salesMap = {};
  if (salesHistory) {
    for (const sh of salesHistory) salesMap[sh.id] = sh;
  }

  let serviceDuplicates = [];
  let salesDuplicates = [];

  for (const g of potentialDuplicates) {
    const groupId = g.txs[0].group_id;
    const productId = g.txs[0].product_id;
    
    // Check A/S
    const sr = serviceMap[groupId];
    if (sr) {
      const parts = sr.parts_used || [];
      // Count how many times this product appears in parts_used
      // Note: parts_used usually aggregates quantity into one item, but let's count items that match product_id
      const matchedParts = parts.filter(p => p.id === productId || p.part_id === productId);
      if (g.txs.length > matchedParts.length) {
        serviceDuplicates.push({
          group_id: groupId,
          customer: sr.customer_name,
          product_name: g.txs[0].product_name,
          expected_max: matchedParts.length,
          actual_txs: g.txs.length,
          tx_ids: g.txs.map(t => t.id)
        });
      }
    }
    
    // Check Sales
    const sh = salesMap[groupId];
    if (sh) {
      const items = sh.items || [];
      const matchedItems = items.filter(i => i.id === productId || i.part_id === productId);
      if (g.txs.length > matchedItems.length) {
        salesDuplicates.push({
          group_id: groupId,
          customer: sh.customer_name,
          product_name: g.txs[0].product_name,
          expected_max: matchedItems.length,
          actual_txs: g.txs.length,
          tx_ids: g.txs.map(t => t.id)
        });
      }
    }
  }

  console.log('--- A/S Records Duplicates ---');
  console.log(serviceDuplicates.length > 0 ? JSON.stringify(serviceDuplicates, null, 2) : 'None');
  
  console.log('\n--- Sales History Duplicates ---');
  console.log(salesDuplicates.length > 0 ? JSON.stringify(salesDuplicates, null, 2) : 'None');
}

verifyOthers();
