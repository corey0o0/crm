const fs = require('fs');

let code = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

// 1. Indexing fix
code = code.replace(
  `if (p.code) { partsByCode[p.code] = cat; partsBrandByCode[p.code] = brand; }`,
  `if (p.code) { partsByCode[p.code] = cat; partsBrandByCode[p.code] = brand; partsNameByCode[p.code] = p.name; }
      if (p.barcode) { partsByCode[p.barcode] = cat; partsBrandByCode[p.barcode] = brand; partsNameByCode[p.barcode] = p.name; }`
);

if (!code.includes('const partsNameByCode = {};')) {
  code = code.replace(`const partsBrandByCode = {};`, `const partsBrandByCode = {};\n    const partsNameByCode = {};`);
}

// 2. Cafe24 pName fix
code = code.replace(
  `const pName = item.product_name || item.name || '상품';`,
  `let pName = item.product_name || item.name || '상품';
          if (itemCode && partsNameByCode[itemCode]) pName = partsNameByCode[itemCode];`
);

// 3. Inventory > 0 fix
code = code.replace(
  `if (qty > 0 || (supplyPrice > 0 && brand !== '-')) {`,
  `if (qty > 0) {`
);

// 4. Sub-totals for channel and subchannel
// In the UI block
const oldUI = `                              return sc.itemsArr.map((item, iIdx) => (
                                <TableRow key={\`\${bIdx}-\${cIdx}-\${scIdx}-\${iIdx}\`} hover>
                                  {cIdx === 0 && scIdx === 0 && iIdx === 0 && (`;
                                  
const newUI = `                              const hasSubTotal = true;
                              return (
                                <React.Fragment key={\`\${bIdx}-\${cIdx}-\${scIdx}\`}>
                                  {sc.itemsArr.map((item, iIdx) => (
                                    <TableRow key={\`\${bIdx}-\${cIdx}-\${scIdx}-\${iIdx}\`} hover>
                                      {cIdx === 0 && scIdx === 0 && iIdx === 0 && (
                                        <TableCell rowSpan={brandRowSpan + b.channelsArr.reduce((s, cc) => s + cc.subChannelsArr.length, 0)} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                          {b.brand}
                                        </TableCell>
                                      )}
                                      {scIdx === 0 && iIdx === 0 && (
                                        <TableCell rowSpan={channelRowSpan + c.subChannelsArr.length} align="center" sx={{ fontWeight: 'bold' }}>
                                          {c.channel}
                                        </TableCell>
                                      )}
                                      {iIdx === 0 && (
                                        <TableCell rowSpan={subChannelRowSpan + 1} align="center">
                                          {sc.subChannel}
                                        </TableCell>
                                      )}
                                      <TableCell sx={{ color: item.isService ? '#ed6c02' : (!item.isAirframe ? '#607d8b' : 'inherit'), fontWeight: !item.isAirframe ? 'bold' : 'normal' }}>
                                        {item.name}
                                      </TableCell>
                                      <TableCell align="center" sx={{ fontWeight: !item.isAirframe || item.isService ? 'bold' : 'normal' }}>
                                        {item.quantity}{item.isService ? '건' : (item.isAirframe ? '대' : '개')}
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                        {formatCurrency(item.amount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow sx={{ bgcolor: '#f1f8e9' }}>
                                    <TableCell sx={{ fontWeight: 'bold', color: '#33691e', fontSize: '0.8rem' }} align="right">[{sc.subChannel} 소계]</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#33691e' }}>{sc.subtotalQty}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#33691e' }}>{formatCurrency(sc.subtotalAmt)}</TableCell>
                                  </TableRow>
                                </React.Fragment>
                              );`;

// Wait, I need to replace it properly.
