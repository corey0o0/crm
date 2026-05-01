const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data: parts } = await supabase.from('parts').select('id, name');
  const partMap = {};
  parts.forEach(p => partMap[p.id] = p.name);

  const { data, error } = await supabase
    .from('cafe24_orders')
    .select('order_id, order_items');

  if (error) {
    console.error(error);
    return;
  }

  const mismatchedOrders = [];

  data.forEach(order => {
    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach(item => {
        const pName = item.part_id ? partMap[item.part_id] : '';
        const itemName = item.name || item.product_name || '';
        const options = item.options || '';
        
        const resolvedName = pName || itemName;
        
        if (resolvedName.includes('레트로 FS Retro FS') && options.includes('매트 블랙')) {
          mismatchedOrders.push({
            order_id: order.order_id,
            resolvedName,
            itemName,
            options,
            part_id: item.part_id
          });
        }
      });
    }
  });

  console.log('Mismatched Orders:', JSON.stringify(mismatchedOrders, null, 2));
})();
