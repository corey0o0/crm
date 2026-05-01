const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { count } = await supabase.from('cafe24_orders').select('*', { count: 'exact', head: true }).eq('is_transferred', true);
  console.log('Total transferred orders:', count);
}
check();
