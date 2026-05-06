require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function test() {
  const { error } = await supabaseAdmin.from('cafe24_orders').upsert([{ order_id: 'test', mall_id: 'test' }]);
  console.log(error);
}
test();
