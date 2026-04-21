require('fs').readFileSync('src/pages/sales/SalesHistory.jsx', 'utf8').split('\n').filter((l, i) => i > 750 && i < 765).forEach(c => console.log(c));
