import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.from('cafe24_orders').select('*').eq('order_id', '20260429-0000157');
  console.log(JSON.stringify(data, null, 2));
}

check();
