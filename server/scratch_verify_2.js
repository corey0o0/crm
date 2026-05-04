require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function isValidUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function verify() {
  const { data: txs } = await supabase.from('transactions').select('*').not('group_id', 'is', null);
  const groups = {};
  for (const tx of txs) {
    if (tx.type !== 'out' || !isValidUUID(tx.group_id)) continue;
    const key = `${tx.group_id}_${tx.product_id}_${tx.quantity}_${tx.from_location}`;
    if (!groups[key]) groups[key] = { txs: [] };
    groups[key].txs.push(tx);
  }

  const potentialDuplicates = Object.values(groups).filter(g => g.txs.length > 1);
  const uniqueGroupIds = [...new Set(potentialDuplicates.map(g => g.txs[0].group_id))];
  const { data: orders } = await supabase.from('cafe24_orders').select('id, order_id, order_items').in('id', uniqueGroupIds);
  const orderMap = {};
  for (const o of orders) orderMap[o.id] = o;
  
  for (const g of potentialDuplicates) {
    const order = orderMap[g.txs[0].group_id];
    if (order) {
      console.log(`Order ${order.order_id}:`);
      console.log(`  - Txs for product ${g.txs[0].product_name} (ID: ${g.txs[0].product_id}): ${g.txs.length}`);
      const matchedItems = order.order_items.filter(item => {
        // Find how many items map to this product (just raw check)
        // Here we just print the items to manually inspect
        return true; 
      });
      console.log(`  - Total items in order: ${order.order_items.length}`);
      console.log(`  - Order items:`);
      order.order_items.forEach(item => {
        console.log(`    * [${item.product_code}] ${item.product_name} - Qty: ${item.quantity}`);
      });
    }
  }
}

verify();
