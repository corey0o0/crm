import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('cafe24_orders')
    .select('mall_id, total_amount');
    
  if (error) {
     console.error('Error:', error);
     return;
  }
  
  const mallStats = {};
  data.forEach(o => {
    const id = o.mall_id || 'Unknown';
    if (!mallStats[id]) mallStats[id] = { count: 0, amount: 0 };
    mallStats[id].count += 1;
    mallStats[id].amount += o.total_amount || 0;
  });
  
  console.log(mallStats);
}

check();
