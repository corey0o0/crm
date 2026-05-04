import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data } = await supabase.from('cafe24_orders').select('*').eq('order_id', '20260429-0000013').single();
  console.log(JSON.stringify(data.order_items, null, 2));
}
run();
