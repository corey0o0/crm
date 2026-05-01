const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder() {
  const { data, error } = await supabase
    .from('cafe24_orders')
    .select('order_id, is_transferred, order_items')
    .in('order_id', ['20260417-0000246', '20260417-0000173']);
  
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
checkOrder();
