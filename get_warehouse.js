import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name')
    .ilike('name', '%청담%');
    
  if (error) {
    console.error(error);
  } else {
    console.log("Warehouses found:", data);
  }
}
check();
