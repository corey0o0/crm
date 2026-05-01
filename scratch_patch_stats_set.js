const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/OnlineStats.jsx', 'utf8');

const target = `setStats({
          totalPayment: total,
          orderCount: filteredOrderCount,
          list: filteredList.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
          agencyStats,
          brandStats,
          generalProductStats
        });`;

const replace = `setStats({
          totalPayment: total,
          orderCount: filteredOrderCount,
          list: filteredList.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()),
          agencyStats,
          brandStats,
          generalProductStats,
          totals: {
            b2b: { airframe: totalB2BAirframeQty, airframeAmt: totalB2BAirframeAmt, parts: totalB2BPartsQty, partsAmt: totalB2BPartsAmt },
            b2c: { airframe: totalB2CAirframeQty, airframeAmt: totalB2CAirframeAmt, parts: totalB2CPartsQty, partsAmt: totalB2CPartsAmt }
          }
        });`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/Stats/OnlineStats.jsx', code);
console.log('Fixed setStats.');
