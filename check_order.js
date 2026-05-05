const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('cafe24_orders').select('order_id, total_amount, order_items').ilike('buyer_name', '%109%').limit(5);
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data, null, 2));
}
check();
