const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin
    .from('cafe24_product_to_part')
    .select(`
      mall_id, 
      cafe24_product_code, 
      part_id,
      parts ( name )
    `);
  console.log("Error:", error);
  console.log("Data:", data ? data.length : 0);
}
run();
