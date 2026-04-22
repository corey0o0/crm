require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: shipments } = await supabaseAdmin
    .from('shipments')
    .select('id, customer_name, note, sales_channel, created_at')
    .in('customer_name', ['주식회사 라이클컴퍼니', '카페24-엑스라이더', '코디바이크']);
    
  console.log(shipments.slice(0, 5));
}

run();
