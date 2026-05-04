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
  
  const regex = /20\d{6}-\d{7}/;
  const matches = shipments.filter(s => s.note && regex.test(s.note));
  
  console.log(`Total shipments with Cafe24 order number format in note: ${matches.length}`);
  if (matches.length > 0) {
    console.log("Examples:");
    matches.slice(0, 10).forEach(m => {
       console.log(`- ID: ${m.id}, Note: ${m.note}, Channel: ${m.sales_channel}`);
    });
  }
}
check();
