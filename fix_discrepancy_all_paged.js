const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAll(table, selectQuery = '*', filters = []) {
  let allData = [];
  let start = 0;
  const limit = 1000;
  while (true) {
    let query = supabase.from(table).select(selectQuery).range(start, start + limit - 1);
    for (const f of filters) {
      if (f.type === 'eq') query = query.eq(f.col, f.val);
      if (f.type === 'like') query = query.like(f.col, f.val);
    }
    const { data, error } = await query;
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < limit) break;
    start += limit;
  }
  return allData;
}

async function fix() {
  const orders = await fetchAll('cafe24_orders', 'id, order_id, order_items', [{type: 'eq', col: 'is_transferred', val: true}]);
  const trans = await fetchAll('transactions', 'note, product_id, product_name, quantity, product_code, from_location', [{type: 'like', col: 'note', val: '%[카페24 %'}]);
  
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
    
    const transQtyMap = {};
    tList.forEach(t => {
      if (!t.product_id) return;
      if (!transQtyMap[t.product_id]) transQtyMap[t.product_id] = 0;
      transQtyMap[t.product_id] += Number(t.quantity || 0);
    });
    
    const itemQtyMap = {};
    let hasUnmappedActiveItem = false;
    
    if (order.order_items) {
      order.order_items.forEach(i => {
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(i.order_status);
        if (isCancelled) return;
        
        if (!i.part_id) {
          hasUnmappedActiveItem = true;
        } else {
          if (!itemQtyMap[i.part_id]) itemQtyMap[i.part_id] = 0;
          itemQtyMap[i.part_id] += Number(i.quantity || 0);
        }
      });
    }
    
    let hasMismatch = false;
    
    for (const [pid, tQty] of Object.entries(transQtyMap)) {
      if (itemQtyMap[pid] !== tQty) { hasMismatch = true; break; }
    }
    if (!hasMismatch) {
      for (const [pid, iQty] of Object.entries(itemQtyMap)) {
        if (transQtyMap[pid] !== iQty) { hasMismatch = true; break; }
      }
    }
    
    if (hasMismatch && tList.length > 0) {
      console.log(`Fixing order ${order.order_id}...`);
      
      const cancelledItems = (order.order_items || []).filter(i => ['C11', 'C40', 'R40', 'E40'].includes(i.order_status));
      const unmappedActiveItems = (order.order_items || []).filter(i => {
        const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(i.order_status);
        return !isCancelled && !i.part_id;
      });
      
      // We must combine transactions that have the same part_id to avoid duplicate order_items
      const mergedTrans = {};
      tList.forEach(t => {
        if (!mergedTrans[t.product_id]) mergedTrans[t.product_id] = { ...t, quantity: 0 };
        mergedTrans[t.product_id].quantity += Number(t.quantity || 0);
      });
      
      const activeTransItems = Object.values(mergedTrans).map(t => ({
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
