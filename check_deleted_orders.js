const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: deletedOrders, error } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, order_date, buyer_name, total_amount, status, is_transferred')
    .eq('is_deleted', true);
    
  if (error) { console.error(error); return; }
  
  console.log(`Found ${deletedOrders.length} total deleted Cafe24 orders.`);
  if (deletedOrders.length > 0) {
    deletedOrders.forEach(o => {
       console.log(`- Date: ${o.order_date}, Order ID: ${o.order_id}, Buyer: ${o.buyer_name}, Amount: ${o.total_amount}, Status: ${o.status}, Transferred: ${o.is_transferred}`);
    });
  }
}
check();
