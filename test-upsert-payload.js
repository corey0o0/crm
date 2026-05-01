const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('access_token').eq('mall_id', 'slimpack79').single();
  const token = mall.access_token;
  
  const res = await axios.post(`http://localhost:3001/api/cafe24/sync/orders/slimpack79`);
  console.log("Sync response:", res.data);
  
  const { data } = await supabaseAdmin.from('cafe24_orders').select('order_id, is_transferred, order_items').eq('order_id', '20260428-0000101').single();
  console.log("DB item after sync:", data.order_items[0]);
}
run();
