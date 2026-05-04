import fs from 'fs';
const file = 'src/components/Inventory/InventoryHistory.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const eff = lines.findIndex(l => l.includes('useEffect(() => {') && (lines.slice(l, l+10).some(x => x.includes('currentPage')) || lines.slice(l-10, l).some(x => x.includes('setFilters'))));
console.log(lines.slice(eff > -1 ? eff - 5 : 0, eff > -1 ? eff + 15 : 20).join('\n'));
