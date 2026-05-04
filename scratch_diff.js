import fs from 'fs';

const sh = fs.readFileSync('src/pages/sales/SalesHistory.jsx', 'utf8');
const st = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

const getBlock = (text, startStr, endStr) => {
  const start = text.indexOf(startStr);
  const end = text.indexOf(endStr, start);
  return text.substring(start, end);
}

const shBlock = getBlock(sh, 'validItems.forEach((item, idx) => {', 'const cat = resolveCategory(pName, itemCode);');
const stBlock = getBlock(st, 'validItems.forEach((item, idx) => {', 'const cat = resolveCategory(pName, itemCode);');

if (shBlock === stBlock) {
  console.log('Cafe24 calculation is EXACTLY IDENTICAL');
} else {
  console.log('SH Block:\n', shBlock);
  console.log('ST Block:\n', stBlock);
}
