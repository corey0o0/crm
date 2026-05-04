import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data: orderData } = await supabase.from('cafe24_orders').select('mall_id').eq('order_id', '20260429-0000013').single();
  const mallId = orderData.mall_id;
  const { data: mallData } = await supabase.from('malls').select('access_token').eq('mall_id', mallId).single();
  const token = mallData.access_token;
  const res = await axios.get(`https://${mallId}.cafe24api.com/api/v2/admin/orders/20260429-0000013?embed=items`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2023-12-01' }
  });
  const items = res.data.order.items;
  items.forEach(item => {
    console.log(`[${item.item_no}] ${item.product_name} (${item.option_value}) - price: ${item.product_price}, option_price: ${item.option_price}, additional_option_value: ${item.additional_option_value}`);
    console.log(`  => payment_amount: ${item.payment_amount}`);
  });
}
run();
