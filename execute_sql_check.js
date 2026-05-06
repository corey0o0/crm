require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { error } = await supabaseAdmin.rpc('execute_sql', { sql: 'SELECT 1;' });
  console.log("Error:", error);
}
run();
