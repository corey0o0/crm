const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data } = await supabaseAdmin.from('parts').select('*').limit(1);
  console.log(Object.keys(data[0] || {}));
}
check();
