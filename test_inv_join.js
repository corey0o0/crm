const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('parts').select('id, name, supply_price, brand, inventory(quantity)').limit(2);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
check();
