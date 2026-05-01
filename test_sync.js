const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data } = await supabase.from('cafe24_orders').select('order_items').eq('order_id', '20260403-0000012');
  console.log('20260403-0000012 has items:', data[0].order_items.length);
  console.log('are they edited?', data[0].order_items.some(i => i.is_edited_in_crm));
}
test();
