const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching transactions...");
  const { data: txs } = await supabase.from('transactions').select('id, group_id, note');
  
  const { data: shipments } = await supabase.from('shipments').select('id, customer_name');
  const { data: services } = await supabase.from('services').select('id, customer_name');
  const { data: orders } = await supabase.from('cafe24_orders').select('order_id, buyer_name');

  const shipMap = {};
  if (shipments) shipments.forEach(s => shipMap[String(s.id)] = s.customer_name);

  const srvMap = {};
  if (services) services.forEach(s => srvMap[String(s.id)] = s.customer_name);

  const ordMap = {};
  if (orders) orders.forEach(o => ordMap[String(o.order_id)] = o.buyer_name);

  let updates = [];
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
        updates.push(supabase.from('transactions').update({ note: newNote }).eq('id', tx.id));
      }
    }
  }

  // Execute in batches of 50
  let updated = 0;
  for (let i = 0; i < updates.length; i += 50) {
    await Promise.all(updates.slice(i, i + 50));
    updated += updates.slice(i, i + 50).length;
    console.log(`Updated ${updated}/${updates.length}...`);
  }
  console.log(`Updated ${updated} transaction notes with customer names.`);
}
run();
