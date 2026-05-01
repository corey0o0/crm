const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: orderData, error: orderError } = await supabase
    .from('cafe24_orders')
    .select('order_id, order_items')
    .eq('order_id', '20260501-0000017')
    .single();

  if (orderError) {
      console.error("Order fetch error:", orderError);
      return;
  }

  console.log("Order ID:", orderData.order_id);
  console.log("\nItems:");
  
  if (orderData.order_items && Array.isArray(orderData.order_items)) {
      for (const item of orderData.order_items) {
          console.log(`- Product Name: ${item.product_name || item.name}`);
          console.log(`  Cafe24 Code : ${item.custom_product_code || item.product_code}`);
          console.log(`  Options     : ${item.option_value || item.options || 'None'}`);
          console.log(`  Mapped Part ID: ${item.part_id || 'NULL (Not Mapped)'}`);
          
          if (item.part_id) {
              const { data: partData } = await supabase.from('parts').select('name, code').eq('id', item.part_id).single();
              if (partData) {
                  console.log(`  Mapped CRM Part: ${partData.name} [${partData.code}]`);
              } else {
                  console.log(`  Mapped CRM Part: Not found in parts table!`);
              }
          }
          console.log('---');
      }
  }
}
check();
