const fs = require('fs');
let code = fs.readFileSync('src/components/Service/ServiceDetail.jsx', 'utf8');

const helperFunc = `
export const getReturnedQty = (usage) => {
  if (!usage) return 0;
  if (usage.includes('[반품완료]')) return -1; // -1 means fully returned
  let rQty = 0;
  if (usage.includes('[부분반품:')) {
    const matches = usage.match(/\\[부분반품:(\\d+)개\\]/g);
    if (matches) {
      matches.forEach(m => {
        const qMatch = m.match(/\\[부분반품:(\\d+)개\\]/);
        if (qMatch) rQty += parseInt(qMatch[1], 10);
      });
    }
  }
  return rQty;
};
`;

if (!code.includes('export const getReturnedQty')) {
  code = code.replace('function ServiceDetail() {', helperFunc + '\nfunction ServiceDetail() {');
  fs.writeFileSync('src/components/Service/ServiceDetail.jsx', code);
  console.log('Successfully added getReturnedQty.');
}

