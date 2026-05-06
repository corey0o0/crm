require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  const { data: orders, error: err1 } = await supabaseAdmin.from('cafe24_orders').select('id, order_id').eq('mall_id', 'nearbike');
  if (err1) { console.error(err1); return; }

  for (const order of orders) {
    if (!order.order_id.startsWith('nearbike_')) {
      const newOrderId = `nearbike_${order.order_id}`;
      await supabaseAdmin.from('cafe24_orders').update({ order_id: newOrderId }).eq('id', order.id);
      
      // Also update pending_outbounds if any
      await supabaseAdmin.from('pending_outbounds').update({ order_no: newOrderId }).eq('order_no', order.order_id);
      console.log(`Updated ${order.order_id} -> ${newOrderId}`);
    }
  }
  console.log('Done!');
}
fix();
