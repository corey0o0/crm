import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking for anomalies in services and transactions...");
  
  const { data: services, error: err1 } = await supabase
    .from('services')
    .select('id, status');
    
  if (err1) {
    console.error("Error fetching services:", err1);
    return;
  }
  
  const { data: serviceParts, error: err2 } = await supabase
    .from('service_parts')
    .select('*');
    
  if (err2) {
    console.error("Error fetching service_parts:", err2);
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
  
  const completedServices = services.filter(s => s.status === '완료');
  const completedServiceIds = new Set(completedServices.map(s => s.id));
  
  const anomalies = [];
  
  for (const part of serviceParts) {
    if (!completedServiceIds.has(part.service_id)) continue;
    // For A/S, part.usage === '수리' or '판매'
    // transaction product_id = part_id
    // transaction group_id = service_id as string
    
    const txs = transactions.filter(t => t.group_id === String(part.service_id) && t.product_id === part.part_id);
    
    if (txs.length === 0) {
      anomalies.push({ type: 'MISSING_TX', service_id: part.service_id, part_id: part.part_id });
    } else {
      const totalTxQty = txs.reduce((sum, t) => sum + t.quantity, 0);
      if (totalTxQty !== part.quantity) {
        anomalies.push({ type: 'QTY_MISMATCH', service_id: part.service_id, part_id: part.part_id, part_qty: part.quantity, tx_qty: totalTxQty });
      }
    }
  }
  
  console.log(`Total A/S anomalies: ${anomalies.length}`);
  if (anomalies.length > 0) {
    const grouped = {};
    for (const a of anomalies) {
      if (!grouped[a.service_id]) grouped[a.service_id] = [];
      grouped[a.service_id].push(a);
    }
    for (const [sId, arr] of Object.entries(grouped)) {
      console.log(`\nService ID: ${sId}`);
      arr.forEach(a => console.log(`  - ${a.type}: PartID ${a.part_id} ${a.type === 'QTY_MISMATCH' ? `(ServiceQty: ${a.part_qty}, TxQty: ${a.tx_qty})` : ''}`));
    }
  }
}

check();
