const fs = require('fs');
try {
  const code = fs.readFileSync('src/pages/sales/SalesHistory.jsx', 'utf8');
  console.log("Read successfully! Lines:", code.split('\n').length);
} catch (e) {
  console.error(e);
}
