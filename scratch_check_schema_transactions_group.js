const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_column_type', {
    table_name: 'transactions',
    column_name: 'group_id'
  });
  console.log("RPC result:", data, error);

  // Fallback: Just insert a text and see if it fails
  console.log("Let's fetch one row of transactions");
  const { data: rows } = await supabase.from('transactions').select('group_id').limit(10);
  console.log(rows);
}
check();
