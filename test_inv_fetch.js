const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: parts } = await supabaseAdmin.from('parts').select('id, name, brand, supply_price').limit(5);
  const { data: inv } = await supabaseAdmin.from('inventory').select('product_id, quantity');
  console.log(`Fetched ${parts.length} parts and ${inv.length} inventory records.`);
}
check();
