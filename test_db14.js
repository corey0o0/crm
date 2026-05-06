require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { count, error } = await supabaseAdmin.from('cafe24_orders').select('*', { count: 'exact', head: true }).eq('mall_id', 'nearbike');
  console.log('Nearbike orders:', count, error);
}
test();
