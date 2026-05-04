const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cafe } = await supabase.from('cafe24_orders').select('id, total_amount, shipping_fee, used_points, order_items').eq('is_transferred', true);
  
  let mismatches = [];
  let totalDiff = 0;
  
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
      
      let expected = Number(o.total_amount);
      if (Math.abs(itemsSum - expected) > 10) {
        mismatches.push({ id: o.id, expected, itemsSum, diff: expected - itemsSum, shipping_fee: o.shipping_fee, used_points: o.used_points });
        totalDiff += (expected - itemsSum);
      }
    }
  });
  
  console.log(`Found ${mismatches.length} Cafe24 orders where sum(items) != total_amount`);
  console.log(`Total Difference: ${totalDiff}`);
  if (mismatches.length > 0) {
    console.log(mismatches.slice(0, 5));
  }
}
check();
