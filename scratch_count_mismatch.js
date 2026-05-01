const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: shipments } = await supabase.from('shipments').select('id, status').eq('status', '출고완료');
  const { count: txShipments } = await supabase.from('transactions').select('group_id', { count: 'exact', head: true }).like('group_id', '%-%-%-%-%');
  
  console.log(`Total completed shipments: ${shipments.length}`);
}
check();
