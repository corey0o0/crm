const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function refreshCafe24Token(mall) {
  const credentials = Buffer.from(`${mall.client_id}:${mall.client_secret_encrypted}`).toString('base64');
  const resp = await axios.post(
    `https://${mall.mall_id}.cafe24api.com/api/v2/oauth/token`,
    `grant_type=refresh_token&refresh_token=${mall.refresh_token}`,
    { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return resp.data.access_token;
}

async function getValidToken() {
  const { data: mall } = await supabase.from('cafe24_settings').select('*').eq('mall_id', 'slimpack79').single();
  return await refreshCafe24Token(mall);
}

async function checkOrder() {
  try {
    const token = await getValidToken();
    const res = await axios.get(`https://slimpack79.cafe24api.com/api/v2/admin/orders/20260405-0000032`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2026-03-01'
      }
    });
    console.log(JSON.stringify({
      payment_amount: res.data.order.payment_amount,
      actual_order_amount: res.data.order.actual_order_amount,
      deposit: res.data.order.deposit,
      total_order_price: res.data.order.total_order_price,
      pg_payment: Number(res.data.order.payment_amount || 0) + Number(res.data.order.naver_point || 0) + Number(res.data.order.prepaid_amount || 0)
    }, null, 2));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
checkOrder();
