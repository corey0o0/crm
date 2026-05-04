import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .limit(5);
    
  if (error) {
     console.error('Error:', error);
  } else {
     if (data && data.length > 0) {
       console.log("shipments fields:", Object.keys(data[0]));
       // Check if there's a field containing "전송"
       const { data: searchData, error: searchError } = await supabase
         .from('shipments')
         .select('id, warehouse_id, sales_channel, status')
         .or('warehouse_id.ilike.%전송%,sales_channel.ilike.%전송%,status.ilike.%전송%');
       console.log("Search result length:", searchData ? searchData.length : 0);
       if (searchData && searchData.length > 0) {
         console.log(searchData.slice(0,5));
       }
     } else {
       console.log("shipments is empty.");
     }
  }
}

check();
