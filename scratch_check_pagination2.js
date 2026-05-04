import fs from 'fs';
const file = 'src/components/Inventory/InventoryManagement.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const eff = lines.findIndex(l => l.includes('const [filter, setFilter]'));
console.log(lines.slice(eff, eff + 20).join('\n'));

const eff2 = lines.findIndex(l => l.includes('useEffect(() => {') && lines.slice(l, l+10).some(x => x.includes('setFilteredTransactions')));
console.log('\nFiltered Transactions Effect:');
console.log(lines.slice(eff2, eff2 + 30).join('\n'));
