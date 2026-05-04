const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('id, note, sales_channel, price')
    .in('status', ['출고완료', '완료']);
    
  if (error) { console.error(error); return; }
  
  // Look for ANY string resembling an order number (e.g. at least 10 digits total with a dash)
  const regex = /\d{4,8}-\d{5,8}/;
  const matches = shipments.filter(s => s.note && regex.test(s.note));
  
  console.log(`Total shipments with some order number format in note: ${matches.length}`);
  if (matches.length > 0) {
    console.log("Examples:");
    matches.slice(0, 10).forEach(m => {
       console.log(`- ID: ${m.id}, Note: ${m.note}, Channel: ${m.sales_channel}`);
    });
  }
}
check();
