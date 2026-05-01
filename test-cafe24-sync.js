const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'server/.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('access_token').eq('mall_id', 'slimpack79').single();
  const token = mall.access_token;
  
  const res = await axios.get(`https://slimpack79.cafe24api.com/api/v2/admin/orders`, {
    params: { start_date: '2026-04-20', end_date: '2026-04-28', date_type: 'order_date', limit: 100, offset: 0, embed: 'items,buyer,receivers' },
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
  });
  
  const order = res.data.orders.find(o => o.order_id === '20260428-0000101');
  if (order) {
    console.log(JSON.stringify(order.items, null, 2));
  } else {
    console.log("Not found in the list");
  }
}
run();
