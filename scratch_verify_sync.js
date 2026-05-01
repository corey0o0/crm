const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: txs } = await supabase.from('transactions').select('date, created_at, group_id, note').order('id', { ascending: false }).limit(5);
  console.log(txs);
}
check();
