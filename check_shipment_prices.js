const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: shipments } = await supabase.from('shipments').select('id, price, shipment_parts(quantity, price)').in('status', ['출고완료', '완료']);
  
  let mismatches = [];
  shipments.forEach(s => {
    let partsSum = 0;
    if (s.shipment_parts && s.shipment_parts.length > 0) {
      partsSum = s.shipment_parts.reduce((sum, p) => sum + ((Number(p.price) || 0) * (Number(p.quantity) || 1)), 0);
      if (Math.abs(partsSum - Number(s.price)) > 1) {
        mismatches.push({ id: s.id, total_price: s.price, parts_sum: partsSum });
      }
    }
  });
  
  console.log(`Found ${mismatches.length} shipments where sum(parts) != shipment.price`);
  if (mismatches.length > 0) {
    console.log(mismatches.slice(0, 10));
  }
}
check();
