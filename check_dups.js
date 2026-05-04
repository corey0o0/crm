import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: shipments, error } = await supabase
      .from('shipments')
      .select('id, note, price, created_at')
      .eq('price', 1690000)
      .order('created_at', { ascending: false })
      .limit(10);

  console.log(shipments);
}

check();
