require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { error } = await supabaseAdmin.from('pending_outbounds').insert([{ order_no: 'test_dup', status: '대기' }, { order_no: 'test_dup', status: '완료' }]);
  console.log('Insert dup pending_outbounds:', error);
}
test();
