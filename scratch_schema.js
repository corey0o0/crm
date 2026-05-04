const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
async function getTypes() {
  const { error: err1 } = await supabase.from('inventory_logs').insert([{ reference_id: '1040' }]);
  console.log('inventory_logs error:', err1?.message);
  const { error: err2 } = await supabase.from('transactions').insert([{ group_id: '1040' }]);
  console.log('transactions error:', err2?.message);
}
getTypes();
