const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAll() {
  console.log('Fetching all orders to check total_amount...');
  
  const { data: orders, error } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, total_amount, shipping_fee, used_points, order_items');
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  let fixedCount = 0;
  
  for (const order of orders) {
    if (!order.order_items || !Array.isArray(order.order_items)) continue;
    
    const hasCancelled = order.order_items.some(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
    
    if (hasCancelled) {
      const items_payment_sum = order.order_items.reduce((sum, it) => {
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(it.order_status);
        return sum + (isCancelled ? 0 : Number(it.payment_amount || 0));
      }, 0);
      
      const current_used_points = Number(order.used_points || 0);
      const expected_total_amount = items_payment_sum + Number(order.shipping_fee || 0) - current_used_points;
      
      if (expected_total_amount !== order.total_amount) {
        console.log(`Order ${order.order_id}: total_amount ${order.total_amount} -> ${expected_total_amount}`);
        
        const { error: updateErr } = await supabase
          .from('cafe24_orders')
          .update({ total_amount: expected_total_amount })
          .eq('id', order.id);
          
        if (!updateErr) fixedCount++;
      }
    }
  }
  
  console.log(`Fixed total_amount for ${fixedCount} orders.`);
}

fixAll();
