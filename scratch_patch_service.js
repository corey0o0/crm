const fs = require('fs');
let code = fs.readFileSync('src/components/Service/ServiceDetail.jsx', 'utf8');

const helperFunc = `
  const getReturnedQty = (usage) => {
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

if (!code.includes('const getReturnedQty')) {
  code = code.replace('const ServiceDetail = () => {', 'const ServiceDetail = () => {\n' + helperFunc);
}

// Update estimate calculations
const oldEstimate1 = `selectedParts.reduce((sum, p) => p.usage && p.usage.includes('[반품완료]') ? sum : sum + (p.price || 0) * (p.quantity || 1), 0)`;
const newEstimate1 = `selectedParts.reduce((sum, p) => {
              const rQty = getReturnedQty(p.usage);
              const effective = rQty === -1 ? 0 : Math.max(0, (p.quantity || 1) - rQty);
              return sum + (p.price || 0) * effective;
            }, 0)`;
code = code.replace(oldEstimate1, newEstimate1).replace(oldEstimate1, newEstimate1).replace(oldEstimate1, newEstimate1);

// Update sum in table
const oldTotalSum = `{selectedParts.reduce((sum, part) => {
                    const partTotal = (part.price || 0) * (part.quantity || 1);
                    return sum + partTotal;
                  }, 0).toLocaleString()}원`;
const newTotalSum = `{selectedParts.reduce((sum, p) => {
                    const rQty = getReturnedQty(p.usage);
                    const effective = rQty === -1 ? 0 : Math.max(0, (p.quantity || 1) - rQty);
                    return sum + (p.price || 0) * effective;
                  }, 0).toLocaleString()}원`;
code = code.replace(oldTotalSum, newTotalSum);

// Update UI rendering for row
const oldRowRender = `            {selectedParts.map((part, index) => (
              <TableRow key={part.id} sx={part.usage && part.usage.includes('[반품완료]') ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                <TableCell>{part.name}</TableCell>
                <TableCell>{part.code}</TableCell>
                <TableCell align="right">
                  {part.price.toLocaleString()}원
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    size="small"
                    value={part.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    sx={{ width: 80 }}
                  />
                </TableCell>
                <TableCell align="right">
                  {((part.price || 0) * (part.quantity || 1)).toLocaleString()}원
                </TableCell>`;

const newRowRender = `            {selectedParts.map((part, index) => {
              const rQty = getReturnedQty(part.usage);
              const isFullyReturned = rQty === -1;
              const effectiveQty = isFullyReturned ? 0 : Math.max(0, (part.quantity || 1) - rQty);
              const rowStyle = isFullyReturned ? { opacity: 0.5, textDecoration: 'line-through' } : (rQty > 0 ? { bgcolor: '#fff3e0' } : {});
              return (
              <TableRow key={part.id} sx={rowStyle}>
                <TableCell>{part.name} {rQty > 0 && <span style={{color: '#ed6c02', fontSize: '0.8rem', marginLeft: 4}}>[{rQty}개 반품]</span>}</TableCell>
                <TableCell>{part.code}</TableCell>
                <TableCell align="right">
                  {part.price.toLocaleString()}원
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    size="small"
                    value={part.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    sx={{ width: 80 }}
                  />
                  {rQty > 0 && <div style={{ fontSize: '0.8rem', color: '#ed6c02', marginTop: 4 }}>적용: {effectiveQty}개</div>}
                </TableCell>
                <TableCell align="right">
                  {((part.price || 0) * effectiveQty).toLocaleString()}원
                </TableCell>`;

code = code.replace(oldRowRender, newRowRender);
code = code.replace(`                  </TableRow>\n            ))}`, `                  </TableRow>\n            )})}`);

fs.writeFileSync('src/components/Service/ServiceDetail.jsx', code);
console.log('Successfully patched ServiceDetail.jsx');
