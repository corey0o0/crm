const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: firstTx } = await supabase.from('transactions').select('created_at').order('created_at', { ascending: true }).limit(1);
  console.log("Earliest transaction:", firstTx[0]);
}
check();
