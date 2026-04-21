require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: trans } = await supabaseAdmin.from('transactions').select('note').eq('type', 'out');
  const { data: orders } = await supabaseAdmin.from('cafe24_orders').select('id, order_id').eq('is_transferred', true);
  
  if (!trans || !orders) return;
  
  let falseAlarms = [];
  
  for (const order of orders) {
     const found = trans.find(t => t.note && t.note.includes(order.order_id));
     if (!found) {
         falseAlarms.push(order.id);
     }
  }
  
  console.log("Found", falseAlarms.length, "historically ignored orders hiding as 'transferred'. Migrating to 'is_deleted = true'...");
  
  if (falseAlarms.length > 0) {
      const { error } = await supabaseAdmin.from('cafe24_orders')
         .update({ is_deleted: true, is_transferred: false })
         .in('id', falseAlarms);
      if (error) console.log("Error migrating:", error);
      else console.log("Migration complete!");
  }
}
run();
