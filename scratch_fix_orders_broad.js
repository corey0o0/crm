const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data: orders, error } = await supabase.from('cafe24_orders').select('order_id, order_items');
  if (error) {
    console.error(error);
    return;
  }
  
  let updateCount = 0;
  for (const order of orders) {
    let changed = false;
    const newItems = order.order_items.map(item => {
      const itemName = item.name || item.product_name || '';
      const options = item.options || '';
      
      // If it's mapped to Sand Beige (1121) but the option explicitly says Matt Black
      if (item.part_id === 1121 && itemName.includes('레트로 FS Retro FS') && options.includes('매트 블랙')) {
        changed = true;
        return { ...item, part_id: 1120 }; // Fix to 매트 블랙
      }
      return item;
    });
    
    if (changed) {
      await supabase.from('cafe24_orders').update({ order_items: newItems }).eq('order_id', order.order_id);
      updateCount++;
    }
  }
  console.log(`Fixed part_id mapping for ${updateCount} past orders based on option strings.`);
})();
