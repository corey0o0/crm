import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('cafe24_orders').select('*').eq('order_id', '20260414-0000171');
  console.dir(data, { depth: null });
}
run();
