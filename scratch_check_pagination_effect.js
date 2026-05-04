import fs from 'fs';
const file = 'src/components/Inventory/InventoryManagement.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const eff = lines.findIndex(l => l.includes('// 필터 변경 시 첫 페이지로 이동'));
console.log(eff);
