import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: shipment } = await supabase.from('shipments').select('*').eq('id', '93148508-b45d-4e3b-9fd3-b9ba1a45ec0a').single();
  console.log('Shipment Note/Tracking:', shipment.note, shipment.tracking_number);
  
  if (shipment.tracking_number) {
     const { data: cafeOrder } = await supabase.from('cafe24_orders').select('*').eq('order_id', shipment.tracking_number);
     console.log('Cafe Order:', cafeOrder);
  }
}
check();
