const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: allTxs } = await supabase.from('transactions').select('id, group_id, product_id, quantity, from_location');
  const { data: allShipments } = await supabase.from('shipments').select('id');
  const { data: shipLogs } = await supabase.from('inventory_logs').select('reference_id, part_id, quantity_change');
  
  const shipmentIds = new Set(allShipments ? allShipments.map(s => String(s.id)) : []);
  const loggedRefIds = new Set(shipLogs ? shipLogs.map(l => String(l.reference_id)) : []);
  
  let orphansWithLogs = [];
  let orphansWithoutLogs = [];
  
  for (const tx of allTxs) {
    const gId = tx.group_id;
    if (gId && String(gId).length < 15 && !String(gId).startsWith('AS-')) {
      if (!shipmentIds.has(String(gId))) {
        // Orphaned
        if (loggedRefIds.has(String(gId))) {
          orphansWithLogs.push(tx);
        } else {
          orphansWithoutLogs.push(tx);
        }
      }
    }
  }
  
  console.log(`Orphans with logs (Need inventory restore): ${orphansWithLogs.length}`);
  console.log(`Orphans without logs (Just delete transactions): ${orphansWithoutLogs.length}`);
}
run();
