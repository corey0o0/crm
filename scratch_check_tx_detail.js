const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: txs } = await supabase.from('transactions').select('*').eq('group_id', 'acfc1671-de0a-4c13-b8d5-50c0cc332c8e');
  console.log("Transactions:", txs);
}
check();
