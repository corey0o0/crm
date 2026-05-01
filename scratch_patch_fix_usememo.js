const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

const errStr = `      let pName = r.product_name || r.part_name || r.name || '상품';
      const itemCode = r.custom_product_code || r.product_code || r.variant_code || '';
      if (itemCode && partsNameByCode[itemCode]) pName = partsNameByCode[itemCode];`;

const fixedStr = `      let pName = r.part_name || '상품';`;

code = code.replace(errStr, fixedStr);
fs.writeFileSync('src/components/Stats/SalesHistoryStats.jsx', code);
console.log('Fixed partsNameByCode undefined error.');
