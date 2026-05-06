require('dotenv').config({ path: 'server/.env' });
const axios = require('axios');
const supabaseAdmin = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { refreshCafe24Token } = require('./server/cafe24Router');

async function test() {
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', 'slimpack79').single();
  
  // Try to get order directly from Cafe24 API
  try {
    const res = await axios.get(`https://slimpack79.cafe24api.com/api/v2/admin/orders`, {
      params: { order_id: '20260412-0000017', embed: 'items,buyer,receivers' },
      headers: { 'Authorization': `Bearer ${mall.access_token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
    });
    const order = res.data.orders[0];
    console.log("Actual Order from Cafe24:");
    console.log("total_order_price:", order.total_order_price);
    console.log("actual_order_amount:", order.actual_order_amount);
    console.log("payment_amount:", order.payment_amount);
    console.log("prepaid_amount:", order.prepaid_amount);
    console.log("Items:");
    order.items.forEach(i => console.log(i.product_name, i.payment_amount, i.product_price));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
