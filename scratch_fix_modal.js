const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/OnlineStats.jsx', 'utf8');

// Inside fetchData where items are processed:
const itemLoopTarget = `const isAirframe = p ? (p.note === '기체') : (pName.includes('기체') || pName.includes('차체'));
               const sup = p ? (p.brand || '기타 브랜드') : '기타 브랜드';`;

const itemLoopReplace = `const isAirframe = p ? (p.note === '기체') : (pName.includes('기체') || pName.includes('차체'));
               const sup = p ? (p.brand || '기타 브랜드') : '기타 브랜드';
               item._brand = sup;
               item._isAirframe = isAirframe;`;
code = code.replace(itemLoopTarget, itemLoopReplace);

// In handleOpenModal:
const modalLoopTarget = `const pCode = String(item.custom_product_code || item.product_code || '').trim();
        const pName = item.name || item.product_name || '';
        const isAirframe = pName.includes('기체') || pName.includes('차체');
        const brand = (pCode.toUpperCase().startsWith('NB') || pName.includes('니어')) ? 'NB' : 'XRB'; // simplified brand check

        if (dataFilter(o, agName, item, isAirframe, brand)) {`;
const modalLoopReplace = `if (dataFilter(o, agName, item, item._isAirframe, item._brand)) {`;
code = code.replace(modalLoopTarget, modalLoopReplace);

fs.writeFileSync('src/components/Stats/OnlineStats.jsx', code);
console.log('Fixed modal logic.');
