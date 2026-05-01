const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: shipments, error: sErr } = await supabase.from('shipments').select('id, note, status').ilike('note', '%20260427-0000238%');
  if (sErr) console.error("Shipment Error:", sErr);
  else {
    console.log("Found Shipments:", shipments);
    if (shipments.length > 0) {
       for (const s of shipments) {
         const { data: txs } = await supabase.from('transactions').select('*').eq('group_id', s.id);
         console.log(`Transactions for shipment ${s.id}:`, txs.length);
       }
    }
  }
}
check();
