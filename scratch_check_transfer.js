const fs = require('fs');
let code = fs.readFileSync('src/pages/cafe24/Cafe24OrderList.jsx', 'utf8');
const match = code.match(/const handleSalesTransfer =([\s\S]*?)(?=const handleCancelTransfer)/);
if (match) console.log(match[0]);
