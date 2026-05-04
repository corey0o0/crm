const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: asOrders, error } = await supabase
    .from('services')
    .select('id, reception_date, completion_date, customer_name, status')
    .ilike('status', '%완료%')
    .is('completion_date', null);
    
  if (error) { console.error(error); return; }
  
  console.log(`Found ${asOrders.length} completed A/S orders with NULL completion_date.`);
  if (asOrders.length > 0) {
    asOrders.forEach(o => {
       console.log(`- ID: ${o.id}, Reception Date: ${o.reception_date}, Customer: ${o.customer_name}, Status: ${o.status}`);
    });
  }
}
check();
