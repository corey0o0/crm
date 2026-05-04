import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const targetId = '93148508-b45d-4e3b-9fd3-b9ba1a45ec0a';

  const { data: parts, error } = await supabase
    .from('shipment_parts')
    .select('*')
    .eq('shipment_id', targetId);
    
  console.log('Shipment Parts:');
  console.log(JSON.stringify(parts, null, 2));
}

check();
