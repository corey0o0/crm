const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: deletedOrders, error } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, order_date, buyer_name, total_amount, status')
    .eq('is_deleted', true)
    .eq('is_transferred', true);
    
  if (error) { console.error(error); return; }
  
  console.log(`Found ${deletedOrders.length} deleted but transferred Cafe24 orders (Bug 1 affected):`);
  if (deletedOrders.length > 0) {
    deletedOrders.forEach(o => {
       console.log(`- Date: ${o.order_date}, Order ID: ${o.order_id}, Buyer: ${o.buyer_name}, Amount: ${o.total_amount}, Status: ${o.status}`);
    });
  }
}
check();
