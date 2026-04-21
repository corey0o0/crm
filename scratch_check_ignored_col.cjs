require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.from('cafe24_orders').select('*').limit(1);
  if (data && data.length > 0) console.log(Object.keys(data[0]));
  else console.log("Error:", error);
}
run();
