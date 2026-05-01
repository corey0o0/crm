const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: parts } = await supabase.from('parts').select('id, code, price');
  const partMap = {};
  parts.forEach(p => partMap[p.id] = p.price);

  const { data: cData, error: cError } = await supabase.from('cafe24_orders').select('id, order_id, total_amount, order_items');
  if (cError) { console.error(cError); return; }

  let problematicOrders = [];
  
  cData.forEach(o => {
      if (!o.total_amount || o.total_amount <= 0) return;
      if (!o.order_items || !Array.isArray(o.order_items) || o.order_items.length === 0) return;
      
      let itemsTotal = 0;
      let allItemsZero = true;

      o.order_items.forEach(item => {
          let itemAmt = 0;
          if (item.payment_amount && item.payment_amount > 0) {
              itemAmt = Number(item.payment_amount);
              allItemsZero = false;
          } else {
              const pPrice = Number(item.product_price || item.price || 0);
              itemAmt = pPrice * Number(item.quantity || 1);
              if (itemAmt > 0) allItemsZero = false;
          }
          itemsTotal += itemAmt;
      });

      // If sum of items is 0 but total_amount > 0, it's problematic
      if (allItemsZero || itemsTotal === 0) {
          problematicOrders.push({
              id: o.id,
              order_id: o.order_id,
              total_amount: o.total_amount,
              item_count: o.order_items.length
          });
      }
  });

  console.log("Problematic orders count:", problematicOrders.length);
  console.log("Samples:", JSON.stringify(problematicOrders.slice(0, 10), null, 2));
}
check();
