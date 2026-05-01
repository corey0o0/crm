const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: o } = await supabase.from('cafe24_orders').select('order_items').eq('order_id', '20260405-0000032');
  console.log('Order:', JSON.stringify(o[0].order_items, null, 2));
  
  const { data: t } = await supabase.from('transactions').select('*').ilike('note', '%20260405-0000032%');
  console.log('Trans:', JSON.stringify(t, null, 2));
}
check();
