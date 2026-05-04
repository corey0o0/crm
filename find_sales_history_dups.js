const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDups() {
  const { data: shipments, error: err1 } = await supabase.from('shipments').select('id, note, sales_channel, price').in('status', ['출고완료', '완료']);
  if (err1) { console.error('Shipments error:', err1); return; }
  
  const { data: cafe, error: err2 } = await supabase.from('cafe24_orders').select('id, order_id').eq('is_transferred', true);
  if (err2) { console.error('Cafe error:', err2); return; }
  
  const cafeOrderIds = new Set(cafe.map(c => c.order_id));
  
  const duplicates = [];
  shipments.forEach(s => {
    let orderNo = null;
    if (s.note) {
      const match = s.note.match(/20\d{6}-\d{7}/);
      if (match) orderNo = match[0];
    }
    
    if (orderNo && cafeOrderIds.has(orderNo)) {
      duplicates.push({ shipment_id: s.id, order_no: orderNo, sales_channel: s.sales_channel, price: s.price });
    }
  });
  
  let dupAmount = duplicates.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
  
  console.log(`Found ${duplicates.length} shipments that also exist in cafe24_orders`);
  console.log(`Total Duplicate Amount: ${dupAmount}`);
  if (duplicates.length > 0) {
    console.log("Examples:", duplicates.slice(0, 10));
  }
}

checkDups();
