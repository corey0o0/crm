const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: orders } = await supabase.from('cafe24_orders').select('id, order_id, order_items').eq('is_transferred', true);
  const { data: trans } = await supabase.from('transactions').select('note, product_id, product_name, quantity, product_code').like('note', '%[카페24 %');
  
  const transMap = {};
  trans.forEach(t => {
    const match = t.note.match(/주문:\s*([A-Z0-9\-]+)/);
    if (match) {
      const oid = match[1];
      if (!transMap[oid]) transMap[oid] = [];
      transMap[oid].push(t);
    }
  });
  
  let discrepant = 0;
  
  for (const order of orders) {
    const tList = transMap[order.order_id] || [];
    
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
    
    if (hasMismatch) {
      console.log(`Order ${order.order_id} has discrepancy!`);
      console.log('  Items in order:', Array.from(itemPartIds));
      console.log('  Items in trans:', Array.from(transPartIds));
      discrepant++;
    }
  }
  console.log(`Total discrepant orders: ${discrepant}`);
}
check();
