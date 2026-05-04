const fs = require('fs');
const file = 'src/components/Service/AddService.jsx';
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(".order('created_at', { ascending: false })")) {
        // Look up to 10 lines back to see if it's 'services' or 'shipments'
        let type = '';
        for (let j = i; j >= Math.max(0, i - 15); j--) {
            if (lines[j].includes(".from('services')")) {
                type = 'reception_date';
                break;
            } else if (lines[j].includes(".from('shipments')")) {
                type = 'order_date';
                break;
            }
        }
        
        if (type) {
            lines[i] = lines[i].replace("order('created_at'", `order('${type}'`);
            console.log(`Replaced at line ${i + 1} with ${type}`);
        }
    }
}

fs.writeFileSync(file, lines.join('\n'));
