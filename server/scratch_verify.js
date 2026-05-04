require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function isValidUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function verify() {
  console.log('Verifying transactions...');
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .not('group_id', 'is', null);

  if (txErr) throw txErr;

  const groups = {};
  for (const tx of txs) {
    if (tx.type !== 'out') continue;
    if (!isValidUUID(tx.group_id)) continue;
    
    const key = `${tx.group_id}_${tx.product_id}_${tx.quantity}_${tx.from_location}`;
    if (!groups[key]) {
      groups[key] = { txs: [] };
    }
    groups[key].txs.push(tx);
  }

  const potentialDuplicates = Object.values(groups).filter(g => g.txs.length > 1);
  
  if (potentialDuplicates.length === 0) {
    console.log('Verification passed: No duplicate out-transactions found for valid UUID group_ids.');
  } else {
    console.log(`WARNING: Still found ${potentialDuplicates.length} potential duplicate groups.`);
    // Fetch orders to verify
    const uniqueGroupIds = [...new Set(potentialDuplicates.map(g => g.txs[0].group_id))];
    const { data: orders } = await supabase
      .from('cafe24_orders')
      .select('id, order_id, order_items')
      .in('id', uniqueGroupIds);
      
    const orderMap = {};
    if (orders) {
      for (const o of orders) orderMap[o.id] = o;
    }
    
    let actualDuplicates = 0;
    for (const g of potentialDuplicates) {
      const order = orderMap[g.txs[0].group_id];
      if (order) {
        const numItemsInOrder = (order.order_items || []).length;
        if (g.txs.length > numItemsInOrder) {
          actualDuplicates++;
          console.log(`Unresolved duplicate found for order ${order.order_id}: expected max ${numItemsInOrder}, got ${g.txs.length}`);
        }
      }
    }
    
    console.log(`Total unresolved confirmed duplicates: ${actualDuplicates}`);
  }
}

verify();
