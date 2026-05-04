import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data: orderData } = await supabaseAdmin.from('cafe24_orders').select('mall_id').eq('order_id', '20260326-0000118').single();
  const mallId = orderData.mall_id;
  const { data: mallData } = await supabaseAdmin.from('malls').select('access_token').eq('mall_id', mallId).single();
  const token = mallData.access_token;
  const res = await axios.get(`https://${mallId}.cafe24api.com/api/v2/admin/orders/20260326-0000118?embed=items`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2023-12-01' }
  });
  console.log(JSON.stringify(res.data.order.actual_order_amount, null, 2));
  console.log(`deposit: ${res.data.order.deposit}`);
  console.log(`payment_amount: ${res.data.order.payment_amount}`);
  console.log(`mileage: ${res.data.order.mileage}`);
}
run();
