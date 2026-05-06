require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('shipments').select('inventory_deducted').limit(1);
  console.log("Error:", error);
  console.log("Data:", data);
}
check();
