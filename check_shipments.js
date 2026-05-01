const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cData, error: cError } = await supabase.from('shipments').select('id, price, shipment_parts(id, price, quantity, total_price)');
  if (cError) { console.error(cError); return; }

  let problematicOrders = [];
  
  cData.forEach(o => {
      if (!o.price || o.price <= 0) return;
      if (!o.shipment_parts || o.shipment_parts.length === 0) return;
      
      let itemsTotal = 0;
      let allItemsZero = true;

      o.shipment_parts.forEach(item => {
          let itemAmt = Number(item.total_price || 0);
          if (itemAmt === 0 && Number(item.price || 0) > 0) {
              itemAmt = Number(item.price) * Number(item.quantity || 1);
          }
          if (itemAmt > 0) allItemsZero = false;
          itemsTotal += itemAmt;
      });

      // If sum of items is 0 but shipment price > 0, we need to distribute
      if (allItemsZero || itemsTotal === 0) {
          problematicOrders.push({
              id: o.id,
              total_amount: o.price,
              item_count: o.shipment_parts.length
          });
      }
  });

  console.log("Problematic shipments count:", problematicOrders.length);
  console.log("Samples:", JSON.stringify(problematicOrders.slice(0, 10), null, 2));
}
check();
