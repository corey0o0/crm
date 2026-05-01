require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: order } = await supabase.from('cafe24_orders').select('*').eq('order_id', '20260423-0000064');
  console.log('Order:', JSON.stringify(order, null, 2));
  
  const { data: trans } = await supabase.from('transactions').select('*').like('note', '%20260423-0000064%');
  console.log('Transactions:', JSON.stringify(trans, null, 2));
}
check();
