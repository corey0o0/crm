const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPartIds() {
  console.log('Fetching parts cache...');
  const { data: parts, error: partsErr } = await supabase.from('parts').select('id, code, barcode');
  if (partsErr) {
    console.error(partsErr);
    return;
  }
  
  const codeToPartId = {};
  parts.forEach(p => {
    if (p.code) codeToPartId[String(p.code).trim()] = p.id;
    if (p.barcode) codeToPartId[String(p.barcode).trim()] = p.id;
  });
  
  console.log('Fetching global mappings...');
  const { data: mappings } = await supabase.from('cafe24_product_mappings').select('*');
  const mappingCache = {};
  if (mappings) {
    mappings.forEach(m => {
      mappingCache[String(m.cafe24_product_code).trim()] = m.crm_part_id;
    });
  }

  console.log('Fetching transferred orders...');
  const { data: orders, error: ordersErr } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, order_items')
    .eq('is_transferred', true);
    
  if (ordersErr) {
    console.error(ordersErr);
    return;
  }
  
  let updateCount = 0;
  
  for (const order of orders) {
    if (!order.order_items || !Array.isArray(order.order_items)) continue;
    
    let changed = false;
    const newItems = order.order_items.map(item => {
      if (!item.part_id) {
        const pCode = item.custom_product_code || item.product_code || '';
        let matchedId = null;
        
        if (pCode) {
          const cleanCode = String(pCode).trim();
          matchedId = mappingCache[cleanCode] || codeToPartId[cleanCode];
        }
        
        if (matchedId) {
          changed = true;
          return { ...item, part_id: matchedId };
        }
      }
      return item;
    });
    
    if (changed) {
      // console.log(`Updating order ${order.order_id}...`);
      const { error } = await supabase
        .from('cafe24_orders')
        .update({ order_items: newItems })
        .eq('id', order.id);
        
      if (!error) updateCount++;
    }
  }
  
  console.log(`Updated part_id for ${updateCount} historically transferred orders.`);
}

fixPartIds();
