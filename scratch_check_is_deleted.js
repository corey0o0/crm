import fs from 'fs';
const file = 'src/components/Inventory/InventoryStatus.jsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const eff = lines.findIndex(l => l.includes('supabase.from(\'parts\')'));
if (eff > -1) {
    console.log(lines.slice(eff, eff + 5).join('\n'));
} else {
    console.log("parts fetch not found");
}
