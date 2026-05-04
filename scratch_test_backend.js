const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseAdmin = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
async function test() {
  const { error: txErr } = await supabaseAdmin.from('transactions').insert([{ group_id: '1040' }]);
  console.log('transactions group_id: 1040 ->', txErr ? txErr.message : 'Success');
  
  const { error: logErr } = await supabaseAdmin.from('inventory_logs').insert([{ reference_id: '1040' }]);
  console.log('inventory_logs reference_id: 1040 ->', logErr ? logErr.message : 'Success');
}
test();
