import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: orders } = await supabaseAdmin.from('cafe24_orders').select('order_id, total_amount, order_items').order('order_date', { ascending: false }).limit(1000);
  for (const o of orders) {
     if (o.order_items) {
        let hasDepositPaymentMethod = o.order_items.some(i => i.payment_method && i.payment_method.includes('예치금'));
        if (hasDepositPaymentMethod) {
            console.log(`Found order with deposit: ${o.order_id}`);
            console.log(`Total Amount: ${o.total_amount}`);
            console.log(JSON.stringify(o.order_items.map(i => ({ name: i.name, payment_amount: i.payment_amount, price: i.price, discount: i.discount_amount, payment_method: i.payment_method })), null, 2));
            break;
        }
     }
  }
}
check();
