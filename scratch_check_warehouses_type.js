import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('warehouses').select('*').limit(1);
  if (data && data.length) {
    for (const key in data[0]) {
      console.log(key, typeof data[0][key], data[0][key]);
    }
  } else {
    console.log('no data or error', error);
  }
}
run();
