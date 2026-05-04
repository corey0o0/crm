import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.rpc('get_schema_info');
  // fallback if no get_schema_info
  const { data: cols, error } = await supabase.from('shipments').select('order_date').limit(1);
  if (error) {
     console.log('Error:', error);
  } else {
     console.log('shipments order_date type can be inferred if we insert and check or look at UI. But let's check format:', cols);
  }
}
run();
