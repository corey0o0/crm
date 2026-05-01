const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data: orders } = await supabase.from('cafe24_orders').select('id, order_id, order_items').eq('is_transferred', true);
  const { data: trans } = await supabase.from('transactions').select('note, product_id, product_name, quantity, product_code, from_location').like('note', '%[카페24 %');
  
  const transMap = {};
  trans.forEach(t => {
    const match = t.note.match(/주문:\s*([A-Z0-9\-]+)/);
    if (match) {
      const oid = match[1];
      if (!transMap[oid]) transMap[oid] = [];
      transMap[oid].push(t);
    }
  });
  
  let fixedCount = 0;
  
  for (const order of orders) {
    const tList = transMap[order.order_id] || [];
    
    // Group transactions by part_id
    const transQtyMap = {};
    tList.forEach(t => {
      if (!t.product_id) return;
      if (!transQtyMap[t.product_id]) transQtyMap[t.product_id] = 0;
      transQtyMap[t.product_id] += Number(t.quantity || 0);
    });
    
    // Group active order items by part_id
    const itemQtyMap = {};
    let hasUnmappedActiveItem = false;
    
    order.order_items.forEach(i => {
      const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(i.order_status);
      if (isCancelled) return;
      
      if (!i.part_id) {
        // If there's an unmapped active item in the DB, it either wasn't shipped (valid) or it was shipped but mapping lost.
        hasUnmappedActiveItem = true;
      } else {
        if (!itemQtyMap[i.part_id]) itemQtyMap[i.part_id] = 0;
        itemQtyMap[i.part_id] += Number(i.quantity || 0);
      }
    });
    
    let hasMismatch = false;
    
    // 1. Check if all transaction quantities match order item quantities
    for (const [pid, tQty] of Object.entries(transQtyMap)) {
      if (itemQtyMap[pid] !== tQty) {
        hasMismatch = true;
        break;
      }
    }
    
    // 2. Check if all order item quantities match transaction quantities
    if (!hasMismatch) {
      for (const [pid, iQty] of Object.entries(itemQtyMap)) {
        if (transQtyMap[pid] !== iQty) {
          hasMismatch = true;
          break;
        }
      }
    }
    
    // 3. If there are no transactions at all but the order is transferred!
    // Wait, some transferred orders genuinely have NO transactions if they were just "개인결제건" entirely.
    // If it was entirely "개인결제건", transQtyMap is empty, itemQtyMap is empty (part_id null), so it matches.
    // BUT what if the user manually replaced an item, and it HAD transactions, but my previous fix missed it?
    
    if (hasMismatch && tList.length > 0) {
      console.log(`Fixing order ${order.order_id}...`);
      
      const cancelledItems = order.order_items.filter(i => ['C11', 'C40', 'R40', 'E40'].includes(i.order_status));
      
      // If the old item was an unmapped "개인결제건", let's keep it as an N40 with part_id null?
      // No! If we reconstruct from transactions, the active items should EXACTLY be the transactions.
      // If the user deliberately mapped it, the transaction represents the FINAL state.
      // But what if the order had "배송비" (part_id null)?
      // "배송비" is NOT in transactions. If we overwrite active items with ONLY transactions, we lose "배송비"!
      // We need to keep active items that are part_id = null (like 배송비, 개인결제건) UNLESS they were what the user replaced.
      // How do we know if they replaced "개인결제건" or kept it?
      // Actually, if we just keep all part_id=null items and append the transactions, the UI will show them correctly.
      
      const unmappedActiveItems = order.order_items.filter(i => {
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(i.order_status);
        return !isCancelled && !i.part_id;
      });
      
      const activeTransItems = tList.map(t => ({
        name: t.product_name,
        product_code: t.product_code || '',
        custom_product_code: t.product_code || '',
        quantity: t.quantity,
        part_id: t.product_id,
        order_status: 'N40', 
        payment_amount: 0, 
        is_edited_in_crm: true,
        _warehouse_id: t.from_location
      }));
      
      const newOrderItems = [...cancelledItems, ...unmappedActiveItems, ...activeTransItems];
      
      const { error } = await supabase
        .from('cafe24_orders')
        .update({ order_items: newOrderItems })
        .eq('id', order.id);
        
      if (error) console.error(error);
      else fixedCount++;
    }
  }
  console.log(`Fixed ${fixedCount} additional orders.`);
}
fix();
