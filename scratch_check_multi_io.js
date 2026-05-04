import fs from 'fs';
const file = 'src/components/Inventory/InventoryManagement.jsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('const handleMultipleIoSubmit = async () => {'));
console.log(lines.slice(start, start + 100).join('\n'));
