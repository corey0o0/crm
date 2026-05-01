const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data: orders } = await supabase.from('cafe24_orders').select('id, order_id, order_items').eq('is_transferred', true);
  const { data: trans } = await supabase.from('transactions').select('note, product_id, product_name, quantity, product_code, from_location').like('note', '%[카페24 %');
  
  const transMap = {};
  trans.forEach(t => {
    const match = t.note.match(/주문:\s*([A-Z0-9\-]+)/);
    if (match) {
      const oid = match[1];
      if (!transMap[oid]) transMap[oid] = [];
      transMap[oid].push(t);
    }
  });
  
  let fixedCount = 0;
  
  for (const order of orders) {
    const tList = transMap[order.order_id];
    if (!tList || tList.length === 0) continue;
    
    // Check if the parts in order_items match the parts in transactions
    const itemPartIds = new Set(order.order_items.map(i => i.part_id).filter(Boolean));
    const transPartIds = new Set(tList.map(t => t.product_id).filter(Boolean));
    
    let hasMismatch = false;
    for (const pid of transPartIds) {
      if (!itemPartIds.has(pid)) {
        hasMismatch = true;
        break;
      }
    }
    
    // If the order_items doesn't contain the parts that were actually shipped, it was wiped.
    if (hasMismatch) {
      console.log(`Fixing order ${order.order_id}...`);
      
      // Preserve any C11/C40/R40/E40 items from the original order for visual history
      const cancelledItems = order.order_items.filter(i => ['C11', 'C40', 'R40', 'E40'].includes(i.order_status));
      
      // Reconstruct the active items from the actual transactions
      const activeItems = tList.map(t => ({
        name: t.product_name,
        product_code: t.product_code || '',
        custom_product_code: t.product_code || '',
        quantity: t.quantity,
        part_id: t.product_id,
        order_status: 'N40', 
        payment_amount: 0, 
        is_edited_in_crm: true,
        _warehouse_id: t.from_location
      }));
      
      const newOrderItems = [...cancelledItems, ...activeItems];
      
      const { error } = await supabase
        .from('cafe24_orders')
        .update({ order_items: newOrderItems })
        .eq('id', order.id);
        
      if (error) console.error(error);
      else fixedCount++;
    }
  }
  console.log(`Fixed ${fixedCount} orders.`);
}
fix();
