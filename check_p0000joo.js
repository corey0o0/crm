const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('parts').select('*').eq('code', 'P0000JOO');
  console.log('parts:', data);
  const { data: mappings } = await supabase.from('cafe24_product_mappings').select('*').eq('cafe24_product_code', 'P0000JOO');
  console.log('mappings:', mappings);
}
check();
