const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('transactions').select('id, group_id, product_id, product_name, note').order('id', { ascending: false }).limit(5);
  if (error) console.error("Error:", error);
  else console.log(data);
}
check();
