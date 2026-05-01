const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: parts } = await supabase.from('parts').select('id, code, price');
  const partMapById = {};
  const partMapByCode = {};
  parts.forEach(p => {
    partMapById[p.id] = p;
    if (p.code) partMapByCode[String(p.code).trim()] = p;
  });

  const { data: cData, error: cError } = await supabase.from('cafe24_orders').select('id, order_id, total_amount, order_items');
  if (cError) { console.error(cError); return; }

  let updatePromises = [];
  
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

      // If sum of items is 0 but total_amount > 0, we need to distribute
      if (allItemsZero || itemsTotal === 0) {
          const validItems = o.order_items;
          let totalWeight = 0;
          validItems.forEach(i => {
              const pCode = String(i.custom_product_code || i.product_code || '').trim();
              const p = i.part_id ? partMapById[i.part_id] : (pCode ? partMapByCode[pCode] : null);
              const pPrice = Number(i.product_price || i.price || (p ? p.price : 0));
              totalWeight += pPrice * Number(i.quantity || 1);
          });
          const totalQty = validItems.reduce((acc, i) => acc + Number(i.quantity || 1), 0);

          const updatedItems = o.order_items.map((item, idx) => {
              const pCode = String(item.custom_product_code || item.product_code || '').trim();
              const p = item.part_id ? partMapById[item.part_id] : (pCode ? partMapByCode[pCode] : null);
              const qty = Number(item.quantity || 1);
               
              let amount = 0;
              if (totalWeight > 0) {
                  const pPrice = Number(item.product_price || item.price || (p ? p.price : 0));
                  amount = Math.floor(((pPrice * qty) / totalWeight) * Number(o.total_amount || 0));
                  if (idx === validItems.length - 1) {
                      const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                          const prevPCode = String(prev.custom_product_code || prev.product_code || '').trim();
                          const prevP = prev.part_id ? partMapById[prev.part_id] : (prevPCode ? partMapByCode[prevPCode] : null);
                          const prevPrice = Number(prev.product_price || prev.price || (prevP ? prevP.price : 0));
                          return acc + Math.floor(((prevPrice * Number(prev.quantity || 1)) / totalWeight) * Number(o.total_amount || 0));
                      }, 0);
                      amount = Number(o.total_amount || 0) - prevTotal;
                  }
              } else if (totalQty > 0) {
                  amount = Math.floor((qty / totalQty) * Number(o.total_amount || 0));
                  if (idx === validItems.length - 1) {
                      const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                          return acc + Math.floor((Number(prev.quantity || 1) / totalQty) * Number(o.total_amount || 0));
                      }, 0);
                      amount = Number(o.total_amount || 0) - prevTotal;
                  }
              }
              return { ...item, payment_amount: amount };
          });

          updatePromises.push(
              supabase.from('cafe24_orders')
                .update({ order_items: updatedItems })
                .eq('id', o.id)
          );
      }
  });

  console.log(`Starting update for ${updatePromises.length} orders...`);
  
  const chunked = [];
  const chunkSize = 10;
  for(let i = 0; i < updatePromises.length; i += chunkSize) {
      chunked.push(updatePromises.slice(i, i + chunkSize));
  }

  for(const chunk of chunked) {
      await Promise.all(chunk);
  }

  console.log(`Successfully updated ${updatePromises.length} orders.`);
}
check();
