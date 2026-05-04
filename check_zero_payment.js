import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: orders, error } = await supabase
    .from('cafe24_orders')
    .select('order_id, buyer_name, total_amount, order_items')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    console.error(error);
    return;
  }

  const zeroPaymentOrders = [];

  for (const order of orders) {
    const items = order.order_items || [];
    let hasZeroPayment = false;
    for (const item of items) {
      if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) === 0) {
        hasZeroPayment = true;
        break;
      }
    }
    if (hasZeroPayment) {
      zeroPaymentOrders.push({
        order_id: order.order_id,
        buyer_name: order.buyer_name,
        total_amount: order.total_amount,
        items: items.map(i => ({ name: i.name, payment_amount: i.payment_amount, price: i.price }))
      });
    }
  }

  console.log(`Found ${zeroPaymentOrders.length} orders with explicit 0 payment_amount in recent 2000 orders.`);
  if (zeroPaymentOrders.length > 0) {
    zeroPaymentOrders.slice(0, 10).forEach(o => {
      console.log(`\nOrder: ${o.order_id} (Buyer: ${o.buyer_name}, Total: ${o.total_amount})`);
      o.items.forEach(i => console.log(`  - ${i.name} | Price: ${i.price} | Payment: ${i.payment_amount}`));
    });
  }
}

check();
