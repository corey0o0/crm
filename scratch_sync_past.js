require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function syncPast() {
  // Find all cafe24 orders that are transferred and have an agency_id
  const { data: orders } = await supabase
    .from('cafe24_orders')
    .select('order_id, agency_id')
    .eq('is_transferred', true)
    .not('agency_id', 'is', null);

  console.log(`Found ${orders.length} transferred orders with an agency_id.`);
  
  let fixedCount = 0;
  for (const order of orders) {
    // Check if there are transactions for this order where to_location is NOT the agency_id
    const { data: trans } = await supabase
      .from('transactions')
      .select('id, to_location, note')
      .like('note', `%${order.order_id}%`)
      .neq('to_location', order.agency_id);
      
    if (trans && trans.length > 0) {
      console.log(`Order ${order.order_id} has ${trans.length} mismatched transactions. Fixing...`);
      // Fix them
      await supabase
        .from('transactions')
        .update({ to_location: order.agency_id, group_id: order.agency_id })
        .in('id', trans.map(t => t.id));
      fixedCount++;
    }
  }
  console.log(`Fixed ${fixedCount} orders that had mismatched agency in statistics.`);
}

syncPast();
