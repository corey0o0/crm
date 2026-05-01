const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findEmpty() {
  const { data: orders, error } = await supabase
    .from('cafe24_orders')
    .select('order_id, is_transferred, order_items');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const emptyItems = [];
  
  orders.forEach(order => {
    if (!order.order_items || !Array.isArray(order.order_items)) return;
    
    order.order_items.forEach(item => {
      const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(item.order_status);
      if (isCancelled) return;
      
      if (!item.part_id) {
        emptyItems.push({
          order_id: order.order_id,
          name: item.name,
          product_code: item.product_code,
          custom_product_code: item.custom_product_code,
          is_transferred: order.is_transferred
        });
      }
    });
  });
  
  console.log(`Found ${emptyItems.length} active items with no part_id.`);
  
  // Group by product name / code to give a summary
  const summary = {};
  emptyItems.forEach(item => {
    const key = `${item.name} (${item.product_code || item.custom_product_code})`;
    if (!summary[key]) summary[key] = { count: 0, example_order: item.order_id, transferred: item.is_transferred };
    summary[key].count++;
  });
  
  console.log('--- Summary of Missing Products ---');
  for (const [key, info] of Object.entries(summary)) {
    console.log(`${key}: ${info.count} times (e.g. ${info.example_order}) - Transferred: ${info.transferred}`);
  }
}

findEmpty();
