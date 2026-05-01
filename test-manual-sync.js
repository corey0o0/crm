const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  console.log("Triggering sync...");
  const res = await axios.post('http://localhost:5001/api/cafe24/sync/orders/slimpack79');
  console.log("Sync response:", res.data);
  
  const { data } = await supabaseAdmin.from('cafe24_orders').select('order_id, order_items').eq('order_id', '20260428-0000101').single();
  console.log("DB item after sync:", data.order_items[0]);
}
run();
