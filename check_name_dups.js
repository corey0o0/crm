const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: shipments } = await supabase.from('shipments').select('id, customer_name, order_date, price').in('status', ['출고완료', '완료']).gte('order_date', '2026-05-01');
  const { data: cafe } = await supabase.from('cafe24_orders').select('id, buyer_name, order_date, total_amount').eq('is_transferred', true).gte('order_date', '2026-05-01');
  
  const cafeMap = {};
  cafe.forEach(c => {
    let name = c.buyer_name || '';
    if (name) cafeMap[name] = c;
  });
  
  let dups = [];
  shipments.forEach(s => {
    let name = s.customer_name || '';
    if (name && cafeMap[name]) {
       dups.push({ shipment: s, cafe: cafeMap[name] });
    }
  });
  
  console.log(`Found ${dups.length} matches by name in May 2026`);
  if (dups.length > 0) {
     console.log(dups);
  }
}
check();
