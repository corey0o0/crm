const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching transactions...");
  const { data: txs, error: txErr } = await supabase.from('transactions').select('id, group_id, note');
  if (txErr) console.error(txErr);
  
  console.log("Fetching shipments...");
  const { data: shipments, error: shipErr } = await supabase.from('shipments').select('id, customer_name');
  if (shipErr) console.error(shipErr);
  
  console.log("Fetching services...");
  const { data: services, error: srvErr } = await supabase.from('services').select('id, customer_name');
  if (srvErr) console.error(srvErr);
  
  console.log("Fetching cafe24 orders...");
  const { data: orders, error: ordErr } = await supabase.from('cafe24_orders').select('order_id, buyer_name');
  if (ordErr) console.error(ordErr);

  const shipMap = {};
  if (shipments) shipments.forEach(s => shipMap[String(s.id)] = s.customer_name);

  const srvMap = {};
  if (services) services.forEach(s => srvMap[String(s.id)] = s.customer_name);

  const ordMap = {};
  if (orders) orders.forEach(o => ordMap[String(o.order_id)] = o.buyer_name);

  let updated = 0;
  if (txs) {
    for (const tx of txs) {
      if (!tx.group_id) continue;
      const gId = String(tx.group_id);
      let customerName = null;

      if (shipMap[gId]) customerName = shipMap[gId];
      else if (srvMap[gId]) customerName = srvMap[gId];
      else if (ordMap[gId]) customerName = ordMap[gId];
      
      if (!customerName && orders) {
        for (const ord of orders) {
          if (gId.includes(ord.order_id)) {
            customerName = ord.buyer_name;
            break;
          }
        }
      }

      if (customerName) {
        if (tx.note && tx.note.includes(customerName)) continue;
        
        const newNote = tx.note ? `${tx.note} - 고객명: ${customerName}` : `고객명: ${customerName}`;
        await supabase.from('transactions').update({ note: newNote }).eq('id', tx.id);
        updated++;
      }
    }
  }
  console.log(`Updated ${updated} transaction notes with customer names.`);
}
run();
