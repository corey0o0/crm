require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function isValidUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function findDuplicates() {
  console.log('Fetching transactions...');
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .not('group_id', 'is', null);

  if (txErr) {
    console.error('Failed to fetch transactions:', txErr);
    return;
  }

  const groups = {};
  for (const tx of txs) {
    if (tx.type !== 'out') continue;
    
    const key = `${tx.group_id}_${tx.product_id}_${tx.quantity}`;
    if (!groups[key]) {
      groups[key] = {
        group_id: tx.group_id,
        product_id: tx.product_id,
        product_name: tx.product_name,
        quantity: tx.quantity,
        txs: []
      };
    }
    groups[key].txs.push(tx);
  }

  const potentialDuplicates = Object.values(groups).filter(g => g.txs.length > 1);
  
  if (potentialDuplicates.length === 0) {
    console.log('No potential duplicates found.');
    return;
  }

  const uniqueGroupIds = [...new Set(potentialDuplicates.map(g => g.group_id))].filter(isValidUUID);
  
  console.log(`Found ${uniqueGroupIds.length} valid UUID groups to verify.`);
  
  const { data: orders, error: orderErr } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, order_items')
    .in('id', uniqueGroupIds);
    
  if (orderErr) {
    console.error('Failed to fetch orders:', orderErr);
    return;
  }
  
  const orderMap = {};
  for (const o of orders) {
    orderMap[o.id] = o;
  }
  
  let actualDuplicates = [];
  
  for (const g of potentialDuplicates) {
    if (!isValidUUID(g.group_id)) continue;
    
    const order = orderMap[g.group_id];
    if (order) {
      const items = order.order_items || [];
      const numItemsInOrder = items.length;
      
      if (g.txs.length > numItemsInOrder) {
        actualDuplicates.push({
          order_id: order.order_id,
          group_id: g.group_id,
          product_name: g.product_name,
          expected_max: numItemsInOrder,
          actual_txs: g.txs.length,
          tx_ids: g.txs.map(t => t.id)
        });
      }
    }
  }
  
  if (actualDuplicates.length > 0) {
    console.log('--- CONFIRMED DUPLICATES ---');
    console.log(JSON.stringify(actualDuplicates, null, 2));
  } else {
    console.log('No confirmed duplicates found among Cafe24 orders.');
  }
}

findDuplicates();
