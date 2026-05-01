const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data } = await supabase.from('cafe24_orders').select('*').eq('order_id', '20260410-0000103');
  console.log(JSON.stringify(data[0].actual_order_amount, null, 2));
  console.log('original pg_payment:', data[0].payment_amount);
  console.log('deposit:', data[0].deposit);
  console.log('total_amount in DB:', data[0].total_amount);
}
check();
