const fs = require('fs');
const file = 'src/pages/sales/TaxInvoiceManagement.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /query \= query\.gte\(dateFilter\.type, \`\$\{\dateFilter\.startDate\}T00:00:00.*?\`\);/g,
  'query = query.gte(dateFilter.type, startOfDay(new Date(dateFilter.startDate)).toISOString());'
);
content = content.replace(
  /query \= query\.lte\(dateFilter\.type, \`\$\{\dateFilter\.endDate\}T23:59:59.*?\`\);/g,
  'query = query.lte(dateFilter.type, endOfDay(new Date(dateFilter.endDate)).toISOString());'
);

if (!content.includes('startOfDay,')) {
  content = content.replace(
    /import \{\s*format, parseISO, isValid/,
    'import { format, parseISO, isValid, startOfDay, endOfDay'
  );
}

fs.writeFileSync(file, content);
