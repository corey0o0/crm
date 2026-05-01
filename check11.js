const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: sData } = await supabase.from('shipments')
    .select('id, note, price, product_name')
    .ilike('note', '%20260417-0000065%');
  console.log("Shipments:", JSON.stringify(sData, null, 2));
  
  const { data: cData } = await supabase.from('cafe24_orders')
    .select('id, order_id, total_amount, actual_payment_amount')
    .ilike('order_id', '%20260417-0000065%');
  console.log("Cafe24:", JSON.stringify(cData, null, 2));
}
check();
