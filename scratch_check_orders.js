import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking for anomalies in shipments and transactions...");
  
  const { data: shipments, error: err1 } = await supabase
    .from('shipments')
    .select('id, sales_channel, status');
    
  if (err1) {
    console.error("Error fetching shipments:", err1);
    return;
  }
  
  const { data: shipmentParts, error: err2 } = await supabase
    .from('shipment_parts')
    .select('*');
    
  if (err2) {
    console.error("Error fetching shipment_parts:", err2);
    return;
  }
  
  const { data: transactions, error: err3 } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'out');
    
  if (err3) {
    console.error("Error fetching transactions:", err3);
    return;
  }
  
  const completedShipments = shipments.filter(s => s.status === '완료' || s.status === '출고완료');
  const completedShipmentIds = new Set(completedShipments.map(s => s.id));
  
  const anomalies = [];
  
  for (const part of shipmentParts) {
    if (!completedShipmentIds.has(part.shipment_id)) continue;
    
    const txs = transactions.filter(t => t.group_id === String(part.shipment_id) && t.product_id === part.part_id);
    
    if (txs.length === 0) {
      anomalies.push({ type: 'MISSING_TX', shipment_id: part.shipment_id, part_id: part.part_id, part_name: part.part_name || part.name });
    } else {
      const totalTxQty = txs.reduce((sum, t) => sum + t.quantity, 0);
      if (totalTxQty !== part.quantity) {
        anomalies.push({ type: 'QTY_MISMATCH', shipment_id: part.shipment_id, part_id: part.part_id, part_qty: part.quantity, tx_qty: totalTxQty });
      }
    }
  }
  
  // Group by shipment_id for easier reading
  const grouped = {};
  for (const a of anomalies) {
    if (!grouped[a.shipment_id]) grouped[a.shipment_id] = [];
    grouped[a.shipment_id].push(a);
  }
  
  console.log(`Total anomalies: ${anomalies.length}`);
  for (const [sId, arr] of Object.entries(grouped)) {
    const s = shipments.find(s => s.id === Number(sId));
    console.log(`\nShipment ID: ${sId} (Channel: ${s.sales_channel})`);
    arr.forEach(a => console.log(`  - ${a.type}: PartID ${a.part_id} ${a.type === 'QTY_MISMATCH' ? `(ShipQty: ${a.part_qty}, TxQty: ${a.tx_qty})` : `(${a.part_name})`}`));
  }
}

check();
