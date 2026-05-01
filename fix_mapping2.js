const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  const { data: mappings } = await supabaseAdmin.from('cafe24_product_to_part').select('*');
  const { data: activeOrders } = await supabaseAdmin.from('cafe24_orders').select('id, order_id, is_transferred, order_items'); // ALL orders
  
  if (!activeOrders || !mappings) return;

  for (const o of activeOrders) {
     if (!o.order_items) continue;
     let modified = false;
     const newItems = o.order_items.map(item => {
        let newItem = { ...item };
        for (const mapping of mappings) {
          const codes = [
            newItem.raw_custom_variant_code,
            newItem.raw_custom_product_code,
            newItem.custom_product_code,
            newItem.product_code
          ].filter(Boolean).map(c => String(c).trim());
          
          if (codes.includes(String(mapping.cafe24_product_code).trim())) {
             if (newItem.part_id !== mapping.part_id) {
               newItem.part_id = mapping.part_id;
               modified = true;
             }
          }
        }
        return newItem;
     });
     if (modified) {
       console.log('Updating order', o.order_id, 'is_transferred:', o.is_transferred);
       await supabaseAdmin.from('cafe24_orders').update({ order_items: newItems }).eq('id', o.id);
     }
  }
}
fix().then(() => console.log('Done')).catch(console.error);
