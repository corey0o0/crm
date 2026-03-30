const axios = require('axios');
const supabase = require('@supabase/supabase-js');
// load env
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './server/.env' });

const supabaseAdmin = supabase.createClient(
  process.env.SUPABASE_URL || 'https://example.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake'
);

async function test() {
  try {
    const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', 'slimpack79').single();
    if (!mall) return console.log('no slimpack79');
    
    // Refresh token code is complex, maybe just query cafe24_orders table if it contains the full payload?
    // Wait, cafe24_orders does NOT contain the raw JSON.
    // So let's try to query cafe24 api directly... Or maybe just check cafe24_settings DB layout?
    console.log("Found mall:", mall.mall_id, mall.access_token ? "has token" : "no token");
    
    if (mall.access_token) {
      const resp = await axios.get(`https://${mall.mall_id}.cafe24api.com/api/v2/admin/orders?limit=3`, {
        headers: {
          'Authorization': `Bearer ${mall.access_token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': '2026-03-01'
        }
      });
      const order = resp.data.orders[0];
      console.log(JSON.stringify({
        actual_order_amount: order.actual_order_amount,
        payment_amount: order.payment_amount,
        amount_details: order.amount_details, 
        mileage: order.mileage,
        deposit: order.deposit,
        total_order_price: order.total_order_price,
        cancel_amount: order.cancel_amount
      }, null, 2));
    }
  } catch(e) { console.error(e.response ? e.response.data : e.message); }
}

test();
