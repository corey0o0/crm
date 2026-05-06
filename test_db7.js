require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  await supabaseAdmin.from('cafe24_orders').delete().eq('order_id', 'test_duplicate_key');

  const { data: d1, error: e1 } = await supabaseAdmin.from('cafe24_orders').insert([{ order_id: 'test_duplicate_key', mall_id: 'mallA' }]);
  console.log('Insert A:', e1);
  const { data: d2, error: e2 } = await supabaseAdmin.from('cafe24_orders').insert([{ order_id: 'test_duplicate_key', mall_id: 'mallB' }]);
  console.log('Insert B:', e2);
}
test();
