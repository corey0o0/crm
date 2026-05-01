const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const payload = {
    order_id: '20260428-0000101',
    mall_id: 'slimpack79',
    order_items: [{
      name: '브레이크 패드',
      price: '15000.00',
      options: '기종=1. 오토바이 브레이크패드 XRB-01',
      part_id: 792,
      quantity: 2,
      product_code: 'P0000IYP',
      item_discount: 0,
      payment_amount: 30000,
      bundle_discount: 0,
      discount_amount: 0,
      custom_product_code: '8809249915821',
      raw_custom_variant_code: '8809249915821'
    }]
  };
  const { data, error } = await supabaseAdmin.from('cafe24_orders').upsert([payload], { onConflict: 'order_id' });
  console.log('Upsert result:', error || 'Success');
  
  const { data: fetchRes } = await supabaseAdmin.from('cafe24_orders').select('order_items').eq('order_id', '20260428-0000101').single();
  console.log('DB item after upsert:', fetchRes.order_items[0].custom_product_code);
}
run();
