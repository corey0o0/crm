import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.REACT_APP_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
async function get() {
  const { data } = await supabase.from('warehouses').select('*');
  console.log(data);
}
get();
