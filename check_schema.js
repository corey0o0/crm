import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  }
}
check();
