require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function test() {
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', 'corey0o0').single();
  const resp = await axios.get(`https://corey0o0.cafe24api.com/api/v2/admin/orders`, {
    params: { order_id: '20260426-0000048', embed: 'items' },
    headers: { 'Authorization': `Bearer ${mall.access_token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
  });
  console.log(JSON.stringify(resp.data.orders[0], null, 2));
}
test();
