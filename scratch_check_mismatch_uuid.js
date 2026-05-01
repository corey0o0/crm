const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const targetId = '7e276b88-2d25-4081-bb32-49f7fa533488'; // A mismatched shipment from the report
  const { data: tx } = await supabase.from('transactions').select('*').eq('group_id', targetId);
  console.log(`Transactions for ${targetId}:`, tx);
}
check();
