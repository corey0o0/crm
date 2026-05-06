require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { error } = await supabaseAdmin.from('cafe24_orders').upsert([{ order_id: 'test_upsert_123', mall_id: 'test_mall' }]);
  console.log('Error:', error);
}
test();
