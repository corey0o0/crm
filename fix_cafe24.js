const fs = require('fs');
let code = fs.readFileSync('src/pages/cafe24/Cafe24OrderList.jsx', 'utf8');

// Fix timezone bug
code = code.replace(/gte\('order_date', `\$\{startDate\}T00:00:00Z`\)/g, "gte('order_date', `${startDate}T00:00:00+09:00`)");
code = code.replace(/lte\('order_date', `\$\{endDate\}T23:59:59Z`\)/g, "lte('order_date', `${endDate}T23:59:59+09:00`)");

// Fix newlines
code = code.replace(/\\\\n/g, "\\n");

// Fix to_location
code = code.replace(/\.update\(\{ to_location: selectedAgency\.id \}\)/g, ".update({ to_location: `대리점:${selectedAgency.name}` })");

fs.writeFileSync('src/pages/cafe24/Cafe24OrderList.jsx', code);
console.log('Fixed Cafe24OrderList dates, newlines, and to_location');
