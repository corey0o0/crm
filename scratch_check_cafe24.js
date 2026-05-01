require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: orders } = await supabase.from('cafe24_orders').select('order_id, order_items').eq('is_transferred', true).order('order_date', { ascending: false }).limit(5);
  console.log(JSON.stringify(orders, null, 2));
}
check();
