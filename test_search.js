import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('shipments').select('id').or('id.ilike.%a%').limit(1);
  console.log('Error from PostgREST:', error);
}
test();
