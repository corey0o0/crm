const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder() {
  const { data, error } = await supabase
    .from('cafe24_orders')
    .select('order_id, used_points, total_amount, order_items')
    .eq('order_id', '20260405-0000032')
    .single();
  
  if (error) {
    console.error(error);
  } else {
    console.log("DB Used Points:", data.used_points);
    console.log("DB Total Amount:", data.total_amount);
  }
}
checkOrder();
