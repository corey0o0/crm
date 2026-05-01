const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('cafe24_orders')
    .select('id, order_id, total_amount, order_items, actual_payment_amount, initial_payment_amount')
    .ilike('order_id', '%20260417-0000065%');
  console.log(JSON.stringify(data, null, 2));
}
check();
