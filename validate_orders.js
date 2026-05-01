const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function validate() {
  const { data: orders, error } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, total_amount, shipping_fee, used_points, order_items');
    
  if (error) {
    console.error(error);
    return;
  }
  
  let anomalies = [];
  
  for (const order of orders) {
    if (!order.order_items || !Array.isArray(order.order_items)) continue;
    
    const hasCancelled = order.order_items.some(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
    
    if (hasCancelled) {
      const items_payment_sum = order.order_items.reduce((sum, it) => {
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(it.order_status);
        return sum + (isCancelled ? 0 : Number(it.payment_amount || 0));
      }, 0);
      
      const expected_used_points = Math.max(0, items_payment_sum + Number(order.shipping_fee || 0) - Number(order.total_amount || 0));
      
      if (Math.abs(expected_used_points - Number(order.used_points || 0)) > 0) {
        anomalies.push({
          order_id: order.order_id,
          total_amount: order.total_amount,
          shipping_fee: order.shipping_fee,
          used_points: order.used_points,
          items_payment_sum,
          expected_used_points,
          reason: 'used_points mismatch'
        });
      } else if (items_payment_sum === 0 && Number(order.total_amount || 0) > 0) {
        // All items cancelled but total_amount > 0?
        anomalies.push({
          order_id: order.order_id,
          total_amount: order.total_amount,
          shipping_fee: order.shipping_fee,
          used_points: order.used_points,
          items_payment_sum,
          reason: 'All items cancelled but total_amount > 0'
        });
      }
    }
  }
  
  console.log(`Found ${anomalies.length} anomalies among partially canceled orders.`);
  if (anomalies.length > 0) {
    console.log(JSON.stringify(anomalies, null, 2));
  }
}

validate();
