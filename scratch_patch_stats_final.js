const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

// 1. Fix parts indexing
const oldPartsIdx = `if (p.code) { partsByCode[p.code] = cat; partsBrandByCode[p.code] = brand; }`;
const newPartsIdx = `if (p.code) { partsByCode[p.code] = cat; partsBrandByCode[p.code] = brand; partsNameByCode[p.code] = p.name; }
      if (p.barcode) { partsByCode[p.barcode] = cat; partsBrandByCode[p.barcode] = brand; partsNameByCode[p.barcode] = p.name; }`;
code = code.replace(oldPartsIdx, newPartsIdx);

// Add partsNameByCode
const oldBrandMap = `const partsBrandByCode = {};`;
const newBrandMap = `const partsBrandByCode = {};\n    const partsNameByCode = {};`;
if (!code.includes('const partsNameByCode = {};')) {
  code = code.replace(oldBrandMap, newBrandMap);
}

// 2. Fix Cafe24 airframe name
const oldCafe24Name = `const pName = item.product_name || item.name || '상품';`;
const newCafe24Name = `let pName = item.product_name || item.name || '상품';
          if (itemCode && partsNameByCode[itemCode]) pName = partsNameByCode[itemCode];`;
code = code.replace(oldCafe24Name, newCafe24Name);

// 3. Fix zero inventory
const oldInvQty = `if (qty > 0 || (supplyPrice > 0 && brand !== '-')) {`;
const newInvQty = `if (qty > 0) {`;
code = code.replace(oldInvQty, newInvQty);

// 4. Align left
code = code.replace(`justifyContent="center" alignItems="center"`, `justifyContent="flex-start" alignItems="center"`);
code = code.replace(`justifyContent="center" alignItems="center"`, `justifyContent="flex-start" alignItems="center"`);

// 5. Add Subtotals for SubChannels
// Currently:
// return sc.itemsArr.map((item, iIdx) => ( ... ));
const uiStartStr = `                              return sc.itemsArr.map((item, iIdx) => (
                                <TableRow key={\`\${bIdx}-\${cIdx}-\${scIdx}-\${iIdx}\`} hover>
                                  {cIdx === 0 && scIdx === 0 && iIdx === 0 && (
                                    <TableCell rowSpan={brandRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                      {b.brand}
                                    </TableCell>
                                  )}
                                  {scIdx === 0 && iIdx === 0 && (
                                    <TableCell rowSpan={channelRowSpan} align="center" sx={{ fontWeight: 'bold' }}>
                                      {c.channel}
                                    </TableCell>
                                  )}
                                  {iIdx === 0 && (
                                    <TableCell rowSpan={subChannelRowSpan} align="center">
                                      {sc.subChannel}
                                    </TableCell>
                                  )}`;

const uiEndStr = `                                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                    {formatCurrency(item.amount)}
                                  </TableCell>
                                </TableRow>
                              ));`;

const newUI = `                              return (
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
                                        <TableCell rowSpan={subChannelRowSpan + 1} align="center" sx={{ bgcolor: '#fff', borderRight: '1px solid #cfd8dc' }}>
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
                                  {/* 소계 행 */}
                                  <TableRow sx={{ bgcolor: '#f1f8e9' }}>
                                    <TableCell sx={{ fontWeight: 'bold', color: '#33691e', fontSize: '0.8rem' }} align="right" colSpan={1}>[{sc.subChannel} 소계]</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', color: '#33691e' }}>{sc.subtotalQty}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#33691e' }}>{formatCurrency(sc.subtotalAmt)}</TableCell>
                                  </TableRow>
                                </React.Fragment>
                              );`;

const idxStart = code.indexOf(uiStartStr);
const idxEnd = code.indexOf(uiEndStr);

if (idxStart !== -1 && idxEnd !== -1) {
  code = code.substring(0, idxStart) + newUI + code.substring(idxEnd + uiEndStr.length);
  fs.writeFileSync('src/components/Stats/SalesHistoryStats.jsx', code);
  console.log('Successfully patched final changes.');
} else {
  console.error('Could not find UI block to replace.');
}

