const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Auditing DB for ShipmentForm/List bugs...");

  // 1. Missing to_location in transactions
  const { data: missingToLoc } = await supabase
    .from('transactions')
    .select('id, group_id, type, created_at')
    .is('to_location', null);
    
  console.log(`Transactions with missing to_location: ${missingToLoc ? missingToLoc.length : 0}`);

  // 2. Orphaned transactions (group_id pointing to a deleted shipment)
  const { data: allTxs } = await supabase.from('transactions').select('id, group_id');
  const { data: allShipments } = await supabase.from('shipments').select('id');
  
  const shipmentIds = new Set(allShipments ? allShipments.map(s => String(s.id)) : []);
  
  let orphanedFromShipment = 0;
  if (allTxs) {
    for (const tx of allTxs) {
      if (tx.group_id && String(tx.group_id).length < 15 && !String(tx.group_id).startsWith('AS-')) {
        // Looks like a shipment ID (not a Cafe24 or Service ID)
        if (!shipmentIds.has(String(tx.group_id))) {
          // Orphaned
          orphanedFromShipment++;
        }
      }
    }
  }
  console.log(`Orphaned transactions (potentially from deleted shipments): ${orphanedFromShipment}`);

  // 3. Shipments that are '출고완료' but have NO inventory_logs
  // Note: Only shipments created/edited recently might be affected, or all of them?
  const { data: completedShipments } = await supabase
    .from('shipments')
    .select('id, created_at')
    .eq('status', '출고완료');
    
  const { data: shipLogs } = await supabase
    .from('inventory_logs')
    .select('reference_id')
    .eq('reference_type', 'shipment');
    
  const loggedShipmentIds = new Set(shipLogs ? shipLogs.map(l => String(l.reference_id)) : []);
  
  let missingLogs = [];
  if (completedShipments) {
    for (const s of completedShipments) {
      if (!loggedShipmentIds.has(String(s.id))) {
        missingLogs.push(s);
      }
    }
  }
  
  console.log(`'출고완료' Shipments missing inventory_logs (Inventory not deducted): ${missingLogs.length}`);
  if (missingLogs.length > 0) {
    console.log("Missing Log Shipment IDs:", missingLogs.map(s => s.id).slice(0, 10));
  }
  
  // 4. Checking if there's any mismatch between transactions and inventory
  // If a shipment was completed via Form, it HAS transactions, but NO inventory_logs.
  let formBugShipments = [];
  if (allTxs && completedShipments) {
    const txShipmentIds = new Set(allTxs.map(t => String(t.group_id)));
    for (const s of missingLogs) {
      if (txShipmentIds.has(String(s.id))) {
        formBugShipments.push(s.id);
      }
    }
  }
  console.log(`Shipments that have transactions but no inventory_logs (Classic Form Bug): ${formBugShipments.length}`);
}
run();
