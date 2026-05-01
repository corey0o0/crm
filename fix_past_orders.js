const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPastOrders() {
  console.log('Fetching orders with used_points > 0...');
  
  // We can also fetch orders where used_points is 0 but it might be incorrectly 0? 
  // No, the bug ONLY inflates used_points because it adds extra items. It wouldn't deflate it.
  const { data: orders, error } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, total_amount, shipping_fee, used_points, order_items')
    .gt('used_points', 0);
    
  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }
  
  console.log(`Found ${orders.length} orders with used_points > 0.`);
  
  let fixedCount = 0;
  
  for (const order of orders) {
    if (!order.order_items || !Array.isArray(order.order_items)) continue;
    
    // Check if there are any cancelled items
    const hasCancelled = order.order_items.some(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
    
    if (hasCancelled) {
      // Recalculate
      const items_payment_sum = order.order_items.reduce((sum, it) => {
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(it.order_status);
        return sum + (isCancelled ? 0 : Number(it.payment_amount || 0));
      }, 0);
      
      const new_used_points = Math.max(0, items_payment_sum + Number(order.shipping_fee || 0) - Number(order.total_amount || 0));
      
      if (new_used_points !== order.used_points) {
        console.log(`Order ${order.order_id}: used_points ${order.used_points} -> ${new_used_points}`);
        
        const { error: updateErr } = await supabase
          .from('cafe24_orders')
          .update({ used_points: new_used_points })
          .eq('id', order.id);
          
        if (updateErr) {
          console.error(`Failed to update ${order.order_id}:`, updateErr);
        } else {
          fixedCount++;
        }
      }
    }
  }
  
  console.log(`Fixed ${fixedCount} orders.`);
}

fixPastOrders();
