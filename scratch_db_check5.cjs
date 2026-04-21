require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: shipments } = await supabaseAdmin.from('shipments')
      .select('id, sales_channel, customer_name, note')
      .ilike('note', '%이카운트%')
      .limit(10);
  console.log(shipments);
}

run();
