const fs = require('fs');

let code = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

const oldSrvCalc = `           let totalAmount = 0;
           (s.service_parts || []).forEach(p => {
               totalAmount += Number(p.parts?.price || 0) * Number(p.quantity || 1);
           });
           rows.push({ ...baseFields, part_category: '공임', part_brand: sBrand, quantity: 1, total_price: totalAmount });`;

const newSrvCalc = `           let totalAmount = 0;
           (s.service_parts || []).forEach(p => {
               let returnedQty = 0;
               if (p.usage && p.usage.includes('[반품완료]')) {
                 returnedQty = Number(p.quantity || 1);
               } else if (p.usage && p.usage.includes('[부분반품:')) {
                 const matches = p.usage.match(/\\[부분반품:(\\d+)개\\]/g);
                 if (matches) {
                   matches.forEach(m => {
                     const qtyMatch = m.match(/\\[부분반품:(\\d+)개\\]/);
                     if (qtyMatch) returnedQty += Number(qtyMatch[1]);
                   });
                 }
               }
               const effectiveQty = Math.max(0, Number(p.quantity || 1) - returnedQty);
               totalAmount += Number(p.parts?.price || 0) * effectiveQty;
           });
           rows.push({ ...baseFields, part_category: '공임', part_brand: sBrand, quantity: 1, total_price: totalAmount });`;

if (code.includes(oldSrvCalc)) {
  code = code.replace(oldSrvCalc, newSrvCalc);
  fs.writeFileSync('src/components/Stats/SalesHistoryStats.jsx', code);
  console.log('Fixed SalesHistoryStats.jsx');
} else {
  console.log('Could not find string in SalesHistoryStats.jsx');
}

