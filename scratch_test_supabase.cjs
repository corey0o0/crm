require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: shipments, error } = await supabaseAdmin
    .from('shipments')
    .select('id, note, sales_channel, created_at')
    .not('note', 'ilike', '%이카운트%')
    .limit(5);
    
  console.log("Error? ", error);
  console.log("Works with string array? Length:", shipments ? shipments.length : 0);
  
  if (shipments) {
     console.log(shipments.map(s => s.note));
  }
}

run();
