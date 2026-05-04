import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  const { data: orders } = await supabaseAdmin.from('cafe24_orders').select('id, order_id, order_items').eq('is_transferred', true).order('order_date', { ascending: false }).limit(200);
  
  let fixedCount = 0;
  for (const order of orders) {
     if (!order.order_items) continue;
     let modified = false;
     
     // 1. Calculate sum of payment_amount
     let currentSum = 0;
     order.order_items.forEach(i => {
       if (!['C11', 'C40', 'R40', 'E40'].includes(i.order_status)) {
           currentSum += Number(i.payment_amount || 0);
       }
     });
     
     // Only fix if there's multiple items with same product_code AND the sum seems inflated
     const pCodeCounts = {};
     order.order_items.forEach(i => {
        const p = String(i.product_code || '').trim();
        if (p) {
            pCodeCounts[p] = (pCodeCounts[p] || 0) + 1;
        }
     });
     
     const hasDuplicates = Object.values(pCodeCounts).some(c => c > 1);
     if (!hasDuplicates) continue;
     
     // For each product_code, identify the "Option" item and set its payment_amount to 0
     const newItems = order.order_items.map(item => {
        const p = String(item.product_code || '').trim();
        if (p && pCodeCounts[p] > 1) {
             const optStr = item.option_value || item.options || '';
             // Heuristic: If options string starts with '기종선택=' or '옵션=', it's likely the secondary option item
             if (optStr.includes('기종선택=') || optStr.includes('색상=') || (optStr.length > 0 && !optStr.includes('선택=') && !optStr.includes(item.name))) {
                  if (item.payment_amount > 0 && item.item_discount === 0 && item.bundle_discount === 0) {
                      modified = true;
                      return { ...item, payment_amount: 0 };
                  }
             }
        }
        return item;
     });
     
     if (modified) {
         console.log(`Fixing order ${order.order_id}`);
         await supabaseAdmin.from('cafe24_orders').update({ order_items: newItems }).eq('id', order.id);
         fixedCount++;
     }
  }
  console.log(`Fixed ${fixedCount} orders.`);
}
fix();
