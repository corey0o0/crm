import fs from 'fs';
const file = 'src/components/Inventory/InventoryManagement.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const eff = lines.findIndex(l => l.includes('fetchProducts'));
console.log(lines.slice(eff - 2, eff + 15).join('\n'));
