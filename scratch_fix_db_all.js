import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  let hasMore = true;
  let lastId = 0;
  let fixedCount = 0;
  
  while (hasMore) {
      const { data: orders } = await supabaseAdmin.from('cafe24_orders').select('id, order_id, order_items').gt('id', lastId).order('id', { ascending: true }).limit(500);
      if (!orders || orders.length === 0) {
          hasMore = false;
          break;
      }
      
      for (const order of orders) {
         lastId = order.id;
         if (!order.order_items) continue;
         let modified = false;
         
         const pCodeCounts = {};
         order.order_items.forEach(i => {
            const p = String(i.product_code || '').trim();
            if (p) {
                pCodeCounts[p] = (pCodeCounts[p] || 0) + 1;
            }
         });
         
         const hasDuplicates = Object.values(pCodeCounts).some(c => c > 1);
         if (!hasDuplicates) continue;
         
         const newItems = order.order_items.map(item => {
            const p = String(item.product_code || '').trim();
            if (p && pCodeCounts[p] > 1) {
                 const optStr = item.option_value || item.options || '';
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
  }
  console.log(`Fixed total ${fixedCount} orders.`);
}
fix();
