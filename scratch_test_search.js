import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('shipments').select('id, customer_name').or('id.eq.80f3a4b1-2c9e-4a1b-9d43-1a2b3c4d5e6f,customer_name.ilike.%a%').limit(1);
  console.log('Result:', data, 'Error:', error);
}
test();
