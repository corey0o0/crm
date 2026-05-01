const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', 'slimpack79').single();
  const token = mall.access_token;
  
  try {
    const res = await axios.get(`https://slimpack79.cafe24api.com/api/v2/admin/orders`, {
      params: { order_id: '20260428-0000101', embed: 'items' },
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
    });
    console.log('Success without dates:', res.data.orders.length);
  } catch(e) {
    console.log('Failed without dates:', e.response ? e.response.data : e.message);
  }
}
run();
