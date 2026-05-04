const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function run() {
  const startDate = '2026-04-01T00:00:00+09:00';
  const endDate = '2026-04-30T23:59:59+09:00';
  
  // 1. Shipments
  const { data: shipRes } = await supabase
    .from('shipments')
    .select('id, price, shipment_parts(id, quantity, price, total_price, note)')
    .in('status', ['출고완료', '완료'])
    .gte('order_date', startDate)
    .lte('order_date', endDate);

  let shipTotal = 0;
  (shipRes || []).forEach(s => {
    const parts = s.shipment_parts || [];
    if (parts.length === 0) {
      shipTotal += Number(s.price || 0);
    } else {
      parts.forEach(p => {
        let returnedQty = 0;
        if (p.note && p.note.includes('[반품완료]')) {
          returnedQty = p.quantity;
        } else if (p.note && p.note.includes('[부분반품:')) {
          const matches = p.note.match(/\[부분반품:(\d+)개\]/g);
          if (matches) {
            matches.forEach(m => {
              const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
              if (qtyMatch && qtyMatch[1]) {
                returnedQty += parseInt(qtyMatch[1], 10);
              }
            });
          }
        }
        const effectiveQty = Math.max(0, Number(p.quantity || 1) - returnedQty);
        shipTotal += Number(p.price || 0) * effectiveQty;
      });
    }
  });

  // 2. Services
  let asQuery = supabase
    .from('services')
    .select('id, reception_date, completion_date')
    .ilike('status', '%완료%')
    .or(`completion_date.gte.${startDate},and(completion_date.is.null,reception_date.gte.${startDate})`)
    .or(`completion_date.lte.${endDate},and(completion_date.is.null,reception_date.lte.${endDate})`);
    
  const { data: asRes } = await asQuery;
  const asIds = (asRes || []).map(s => s.id);
  
  let asTotal = 0;
  if (asIds.length > 0) {
    const { data: spData } = await supabase
      .from('service_parts')
      .select('id, service_id, quantity, price, usage, parts(name, price)')
      .in('service_id', asIds);
      
    (spData || []).forEach(sp => {
      let returnedQty = 0;
      if (sp.usage && sp.usage.includes('[반품완료]')) {
        returnedQty = sp.quantity;
      } else if (sp.usage && sp.usage.includes('[부분반품:')) {
        const matches = sp.usage.match(/\[부분반품:(\d+)개\]/g);
        if (matches) {
          matches.forEach(m => {
            const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
            if (qtyMatch && qtyMatch[1]) returnedQty += parseInt(qtyMatch[1], 10);
          });
        }
      }
      const effectiveQty = Math.max(0, Number(sp.quantity || 1) - returnedQty);
      const unitPrice = sp.price !== undefined && sp.price !== null ? Number(sp.price) : Number(sp.parts?.price || 0);
      asTotal += unitPrice * effectiveQty;
    });
  }

  // 3. Cafe24
  const { data: cafeRes } = await supabase
    .from('cafe24_orders')
    .select('id, total_amount, order_items')
    .eq('is_transferred', true)
    .gte('order_date', startDate)
    .lte('order_date', endDate);
    
  const cafeIds = (cafeRes || []).map(o => String(o.id));
  const cafeWarehouseMap = {};
  if (cafeIds.length > 0) {
    const { data: txData } = await supabase
      .from('transactions')
      .select('group_id, product_id, from_location')
      .in('group_id', cafeIds)
      .eq('type', 'out');
    (txData || []).forEach(tx => {
       cafeWarehouseMap[tx.group_id] = tx.from_location;
       if (tx.product_id) cafeWarehouseMap[`${tx.group_id}_${tx.product_id}`] = tx.from_location;
    });
  }
  
  let cafeTotal = 0;
  (cafeRes || []).forEach(o => {
    const items = o.order_items || [];
    const fallbackWid = cafeWarehouseMap[o.id];
    const hasWarehouseInfo = items.some(item => item._warehouse_id) || fallbackWid;
    if (!hasWarehouseInfo) return; // 반영 예외 무시
    
    if (items.length === 0) {
      cafeTotal += Number(o.total_amount || 0);
    } else {
      const validItems = items.filter(item => !['C11', 'C40', 'R40', 'E40'].includes(item.order_status));
      if (validItems.length === 0) return;
      
      let totalWeight = validItems.reduce((acc, i) => {
         let qty = Number(i.quantity || 1);
         let p = Number(i.product_price || i.price || 0) * qty;
         return acc + p;
      }, 0);
      
      validItems.forEach((item, idx) => {
        const itemQty = Number(item.quantity || 1);
        let paymentAmt = 0;
        if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
           paymentAmt = Number(item.payment_amount);
        } else {
           paymentAmt = Number(item.product_price || item.price || 0) * itemQty;
        }
        let iPrice = Number(item.product_price || item.price || 0);
        let itemTotal = 0;
        
        if (paymentAmt > 0) {
          itemTotal = paymentAmt;
        } else {
          let itemWeight = iPrice * itemQty;
          if (totalWeight > 0) {
             itemTotal = Math.floor((itemWeight / totalWeight) * Number(o.total_amount || 0));
             if (idx === validItems.length - 1) {
                let previousTotals = validItems.slice(0, validItems.length - 1).reduce((acc, prevItem) => {
                   let prevQty = Number(prevItem.quantity || 1);
                   let prevWeight = Number(prevItem.product_price || prevItem.price || 0) * prevQty;
                   return acc + Math.floor((prevWeight / totalWeight) * Number(o.total_amount || 0));
                }, 0);
                itemTotal = Number(o.total_amount || 0) - previousTotals;
             }
          } else {
             itemTotal = Math.floor(Number(o.total_amount || 0) / validItems.length);
             if (idx === validItems.length - 1) {
                itemTotal = Number(o.total_amount || 0) - (itemTotal * (validItems.length - 1));
             }
          }
        }
        cafeTotal += itemTotal;
      });
    }
  });

  console.log('Shipments:', shipTotal);
  console.log('Services:', asTotal);
  console.log('Cafe24:', cafeTotal);
  console.log('Total:', shipTotal + asTotal + cafeTotal);
}

run();
