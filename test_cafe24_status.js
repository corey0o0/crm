const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('cafe24_orders').select('status').neq('status', 'unknown');
  const counts = {};
  if (data) {
    data.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  }
  console.log(counts);
}
run();
