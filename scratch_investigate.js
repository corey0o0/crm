const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Check the order in the DB
  const { data: order, error } = await supabase
    .from('cafe24_orders')
    .select('order_id, order_items')
    .eq('order_id', '20260425-0000040');

  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Order Items:', JSON.stringify(order[0].order_items, null, 2));
  
  // Check the mapping logic. How are we mapping?
  // Check the parts table for the barcodes
  const { data: parts, error: partsError } = await supabase
    .from('parts')
    .select('id, name, barcode, code')
    .in('barcode', ['8809249919102', '8809249919119']);
    
  console.log('\nParts with barcodes:', JSON.stringify(parts, null, 2));
  
  // Check cafe24_product_mappings
  // What is the cafe24 product_no / item_no for this order item?
  if (order[0].order_items[0]) {
    const item = order[0].order_items[0];
    const { data: mapping } = await supabase
      .from('cafe24_product_mappings')
      .select('*')
      .eq('cafe24_product_no', item.product_no)
      .eq('cafe24_item_no', item.item_no || '');
      
    console.log('\nMappings:', JSON.stringify(mapping, null, 2));
  }

})();
