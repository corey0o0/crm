import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: shipments, error } = await supabase
      .from('shipments')
      .select('id, order_date, customer_name, price, sales_channel, status, note, warehouse_id, shipment_parts(id, part_name, quantity, price, total_price, note)')
      .in('status', ['출고완료', '완료'])
      .order('order_date', { ascending: false })
      .limit(10);

  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Fetched ${shipments.length} shipments.`);
  shipments.forEach(s => {
      console.log(`Shipment: ${s.id.slice(0,8)} | Parts: ${s.shipment_parts?.length}`);
  });
  
  // Check if there are duplicate IDs
  const ids = shipments.map(s => s.id);
  const uniqueIds = new Set(ids);
  console.log(`Unique IDs: ${uniqueIds.size} vs Total: ${ids.length}`);
}

check();
