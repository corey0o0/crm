const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('access_token').eq('mall_id', 'slimpack79').single();
  const token = mall.access_token;
  
  const resList = await axios.get(`https://slimpack79.cafe24api.com/api/v2/admin/orders`, {
    params: { start_date: '2026-04-20', end_date: '2026-04-28', date_type: 'order_date', limit: 100, embed: 'items' },
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
  });
  const oList = resList.data.orders.find(o => o.order_id === '20260428-0000101');
  
  const resDetail = await axios.get(`https://slimpack79.cafe24api.com/api/v2/admin/orders/20260428-0000101?embed=items`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
  });
  const oDetail = resDetail.data.order;

  console.log('List API custom_variant_code:', oList.items[0].custom_variant_code);
  console.log('Detail API custom_variant_code:', oDetail.items[0].custom_variant_code);
}
run();
