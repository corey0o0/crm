const fs = require('fs');
const file = 'src/pages/shipment/ShipmentList.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /startDate: format\(new Date\(dateFilter\.startDate\), 'yyyy-MM-dd 00:00:00'\)/g,
  'startDate: startOfDay(new Date(dateFilter.startDate)).toISOString()'
);
content = content.replace(
  /endDate: format\(new Date\(dateFilter\.endDate\), 'yyyy-MM-dd 23:59:59'\)/g,
  'endDate: endOfDay(new Date(dateFilter.endDate)).toISOString()'
);

// We also need to import startOfDay and endOfDay in ShipmentList.jsx
if (!content.includes('startOfDay,')) {
  content = content.replace(
    /import \{\s*format, parseISO, isValid,/,
    'import {\n  format, parseISO, isValid, startOfDay, endOfDay,'
  );
}

fs.writeFileSync(file, content);
