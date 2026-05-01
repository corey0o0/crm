const fs = require('fs');
let code = fs.readFileSync('server/cafe24Router.js', 'utf8');

// 1. We need to save agency_id into existingOrderMap
const target1 = `data.forEach(row => existingOrderMap.set(row.order_id, { 
          items: row.order_items, 
          isTransferred: row.is_transferred,
          total_amount: row.total_amount,
          shipping_fee: row.shipping_fee,
          used_points: row.used_points
        }));`;
const replace1 = `data.forEach(row => existingOrderMap.set(row.order_id, { 
          items: row.order_items, 
          isTransferred: row.is_transferred,
          total_amount: row.total_amount,
          shipping_fee: row.shipping_fee,
          used_points: row.used_points,
          agency_id: row.agency_id
        }));`;
code = code.replace(target1, replace1);

// 2. We need existingOrderMap logic to apply agency_id back if cafe24ToAgencyMap didn't have it
const target2 = `const existingData = existingOrderMap.get(p.order_id);
      if (existingData) {`;
const replace2 = `const existingData = existingOrderMap.get(p.order_id);
      if (existingData) {
        if (!cafe24ToAgencyMap[String(p.buyer_id || '').trim()] && existingData.agency_id) {
          p.agency_id = existingData.agency_id; // 수동으로 변경된 거래처 유지
        }`;
code = code.replace(target2, replace2);

// We need to fetch agency_id in the chunk
const target3 = `const { data } = await supabaseAdmin.from('cafe24_orders').select('order_id, is_transferred, order_items, total_amount, shipping_fee, used_points').in('order_id', chunk);`;
const replace3 = `const { data } = await supabaseAdmin.from('cafe24_orders').select('order_id, is_transferred, order_items, total_amount, shipping_fee, used_points, agency_id').in('order_id', chunk);`;
code = code.replace(target3, replace3);

fs.writeFileSync('server/cafe24Router.js', code);
console.log('patched cafe24Router.js!');
