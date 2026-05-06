require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { data, error } = await supabaseAdmin.from('cafe24_orders').select('*').eq('order_id', '20260412-0000017');
  console.log(JSON.stringify(data, null, 2));
}
test();
