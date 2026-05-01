const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: order } = await supabase.from('cafe24_orders').select('order_items').eq('order_id', '20260421-0000046');
  console.log('--- order_items ---');
  console.log(JSON.stringify(order[0].order_items, null, 2));

  const { data: trans } = await supabase.from('transactions').select('*').ilike('note', '%20260421-0000046%');
  console.log('--- transactions ---');
  console.log(JSON.stringify(trans, null, 2));
}
check();
