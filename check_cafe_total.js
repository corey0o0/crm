const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cafe } = await supabase.from('cafe24_orders').select('id, order_id, total_amount, shipping_fee, used_points, order_items').order('order_date', { ascending: false }).limit(20);
  
  cafe.forEach(o => {
    let itemsSum = 0;
    if (o.order_items && o.order_items.length > 0) {
      o.order_items.forEach(item => {
         if (!['C11', 'C40', 'R40', 'E40'].includes(item.order_status)) {
           let pAmt = Number(item.payment_amount);
           if (isNaN(pAmt)) {
              let qty = Number(item.quantity || 1);
              pAmt = Number(item.product_price || item.price || 0) * qty;
           }
           itemsSum += pAmt;
         }
      });
    }
    console.log(`Order ${o.order_id}: total_amount=${o.total_amount}, itemsSum=${itemsSum}, shipping_fee=${o.shipping_fee}, used_points=${o.used_points}`);
  });
}
check();
