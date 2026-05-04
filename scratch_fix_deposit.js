import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  const { data: orders } = await supabaseAdmin.from('cafe24_orders').select('id, order_id, order_items, total_amount').limit(5000);
  
  let fixedCount = 0;
  for (const o of orders) {
     if (!o.order_items) continue;
     
     let hasDeposit = o.order_items.some(i => i.payment_method && i.payment_method.includes('예치금'));
     let hasPoints = o.order_items.some(i => i.payment_method && i.payment_method.includes('적립금'));
     
     if (hasDeposit && !hasPoints) {
         // If it has ONLY deposit, we want total_amount to equal the sum of item payment_amounts
         let sum = 0;
         o.order_items.forEach(i => {
             if (!['C11', 'C40', 'R40', 'E40'].includes(i.order_status)) {
                 sum += Number(i.payment_amount || 0);
             }
         });
         
         if (sum > 0 && o.total_amount !== sum) {
             console.log(`Fixing deposit order ${o.order_id}: total_amount ${o.total_amount} -> ${sum}`);
             await supabaseAdmin.from('cafe24_orders').update({ total_amount: sum, used_points: 0 }).eq('id', o.id);
             fixedCount++;
         }
     }
  }
  console.log(`Fixed ${fixedCount} deposit orders.`);
}
fix();
