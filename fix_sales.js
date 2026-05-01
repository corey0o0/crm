const fs = require('fs');
let code = fs.readFileSync('src/pages/sales/SalesHistory.jsx', 'utf8');

code = code.replace(/gte\('order_date',\s*format\(activeStart,\s*'yyyy-MM-dd'\)\)/g, "gte('order_date', format(activeStart, 'yyyy-MM-dd') + 'T00:00:00+09:00')");
code = code.replace(/lte\('order_date',\s*format\(activeEnd,\s*'yyyy-MM-dd'\)\s*\+\s*'T23:59:59'/g, "lte('order_date', format(activeEnd, 'yyyy-MM-dd') + 'T23:59:59+09:00'");

// services
code = code.replace(/const sDate = format\(activeStart, 'yyyy-MM-dd'\);/g, "const sDate = format(activeStart, 'yyyy-MM-dd') + 'T00:00:00+09:00';");
code = code.replace(/const eDate = format\(activeEnd, 'yyyy-MM-dd'\) \+ 'T23:59:59';/g, "const eDate = format(activeEnd, 'yyyy-MM-dd') + 'T23:59:59+09:00';");

fs.writeFileSync('src/pages/sales/SalesHistory.jsx', code);
console.log('Fixed SalesHistory dates');
