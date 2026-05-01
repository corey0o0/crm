const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  const { data: orders } = await supabaseAdmin.from('cafe24_orders').select('id, order_id, order_items').eq('is_transferred', true);
  
  let fixedCount = 0;
  for (const o of orders) {
    if (!o.order_items) continue;
    let modified = false;
    
    // Check if any item is null
    const hasNull = o.order_items.some(i => i.part_id === null);
    if (!hasNull) continue;

    // Get transactions for this order
    const { data: txs } = await supabaseAdmin.from('transactions').select('*').like('note', `%${o.order_id}%`);
    if (!txs || txs.length === 0) continue;

    const newItems = [...o.order_items];
    for (let i = 0; i < newItems.length; i++) {
      if (newItems[i].part_id === null) {
        // Try to find matching transaction
        // First, check by name loosely
        let matchedTx = txs.find(tx => tx.product_name && tx.product_name.includes(newItems[i].name.split('-')[0].trim()));
        if (!matchedTx) {
            // Fallback to just taking the transaction if there's only 1 item and 1 tx
            if (newItems.length === 1 && txs.length === 1) {
                matchedTx = txs[0];
            }
        }
        
        if (matchedTx && matchedTx.product_id) {
          newItems[i].part_id = matchedTx.product_id;
          newItems[i]._warehouse_id = matchedTx.from_location;
          modified = true;
          console.log(`Fixed ${o.order_id} item: ${newItems[i].name} -> part_id: ${matchedTx.product_id}`);
        }
      }
    }

    if (modified) {
      await supabaseAdmin.from('cafe24_orders').update({ order_items: newItems }).eq('id', o.id);
      fixedCount++;
    }
  }
  console.log(`Fixed ${fixedCount} orders.`);
}

fix().then(() => console.log('Done')).catch(console.error);
