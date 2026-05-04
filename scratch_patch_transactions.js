import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Fetch transactions with note containing "[카페24"
  const { data: txs, error: txErr } = await supabase.from('transactions').select('id, group_id, note').like('note', '%[카페24%주문:%');
  if (txErr) return console.error(txErr);
  
  console.log(`Found ${txs.length} transactions from Cafe24.`);
  let updated = 0;
  for (const tx of txs) {
    // note format: "[카페24 B2C 전송] 주문: 20260422-0000030 (출고처:기본창고)"
    const match = tx.note.match(/주문:\s*([^\s]+)/);
    if (match && match[1]) {
      const orderId = match[1];
      const { data: order } = await supabase.from('cafe24_orders').select('id').eq('order_id', orderId).single();
      if (order && String(order.id) !== String(tx.group_id)) {
        await supabase.from('transactions').update({ group_id: String(order.id) }).eq('id', tx.id);
        updated++;
      }
    }
  }
  console.log(`Fixed group_id for ${updated} transactions.`);
}
run();
