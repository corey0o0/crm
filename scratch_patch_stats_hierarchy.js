const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

const useMemoStartStr = `const { comprehensiveSalesGroups, comprehensiveInventoryGroups } = React.useMemo(() => {`;
const useMemoEndStr = `return {
      comprehensiveSalesGroups: salesArr,
      comprehensiveInventoryGroups: invArr
    };
  }, [currentFiltered, agenciesList, inventoryList]);`;

const newUseMemoLogic = `const { comprehensiveSalesGroups, comprehensiveInventoryGroups } = React.useMemo(() => {
    // 1. 판매 매출 그룹화
    // 구조: CustomerType(대리점/일반고객/A/S) -> Brand -> ItemKey -> { qty, amount }
    const sGroupData = {};
    
    currentFiltered.forEach(r => {
      let brand = r.part_brand || '기타';
      if (brand === '-') brand = '기타';
      
      const ch = r.sales_channel || '';
      
      // 대분류: 대리점 / 일반고객 / A/S
      let customerType = '일반 고객 매출';
      
      if (r._type === 'service') {
        customerType = 'A/S 매출';
      } else {
        const isAgency = agenciesList.some(a => r.customer_name?.includes(a) || r.sales_channel?.includes(a)) || ch.includes('대리점');
        if (isAgency) {
          customerType = '대리점 매출';
        } else {
          customerType = '일반 고객 매출';
        }
      }
      
      // 기체 vs 파츠 분류
      let pName = r.product_name || r.part_name || r.name || '상품';
      const itemCode = r.custom_product_code || r.product_code || r.variant_code || '';
      if (itemCode && partsNameByCode[itemCode]) pName = partsNameByCode[itemCode];
      
      const isAirframe = r.part_category === '기체';
      const isService = r._type === 'service';
      
      const qty = Number(r.quantity || 0);
      const amt = Number(r.total_price || 0);

      if (!sGroupData[customerType]) {
        sGroupData[customerType] = { customerType, brands: {}, totalQty: 0, totalAmt: 0 };
      }
      
      const typeNode = sGroupData[customerType];
      if (!typeNode.brands[brand]) {
        typeNode.brands[brand] = { brand, items: {}, subtotalQty: 0, subtotalAmt: 0 };
      }
      
      const brandNode = typeNode.brands[brand];
      
      let itemKey = '';
      let itemName = '';
      
      if (isService) {
        itemKey = 'as_total';
        itemName = 'A/S 처리 (공임/부품 포함)';
      } else if (!isAirframe) {
        itemKey = 'parts_total';
        itemName = '[ 파츠 총합 ]';
      } else {
        itemKey = pName;
        itemName = pName;
      }
      
      if (!brandNode.items[itemKey]) {
         brandNode.items[itemKey] = { name: itemName, isAirframe, isService, quantity: 0, amount: 0 };
      }
      
      brandNode.items[itemKey].quantity += qty;
      brandNode.items[itemKey].amount += amt;
      
      brandNode.subtotalQty += qty;
      brandNode.subtotalAmt += amt;
      typeNode.totalQty += qty;
      typeNode.totalAmt += amt;
    });

    const typeOrder = { '대리점 매출': 1, '일반 고객 매출': 2, 'A/S 매출': 3 };
    const salesArr = Object.values(sGroupData).map(t => ({
      ...t,
      brandsArr: Object.values(t.brands).map(b => ({
        ...b,
        itemsArr: Object.values(b.items).sort((i1, i2) => {
             if (i1.isService) return 1;
             if (i2.isService) return -1;
             if (i1.isAirframe && !i2.isAirframe) return -1;
             if (!i1.isAirframe && i2.isAirframe) return 1;
             return i2.amount - i1.amount;
        })
      })).sort((a,b) => b.subtotalAmt - a.subtotalAmt)
    })).sort((a,b) => (typeOrder[a.customerType] || 99) - (typeOrder[b.customerType] || 99));

    // 2. 재고 현황 그룹화
    // 구조: Brand -> ItemKey -> { qty, amount }
    const iGroupData = {};
    
    inventoryList.forEach(inv => {
      let brand = inv.brand || '기타';
      if (brand === '-') brand = '기타';
      
      const pName = inv.part_name || '상품';
      const isAirframe = inv.category === '기체';
      const qty = Number(inv.quantity || 0);
      const amt = Number(inv.amount || 0);
      
      if (qty > 0) {
        if (!iGroupData[brand]) {
          iGroupData[brand] = { brand, items: {}, totalQty: 0, totalAmt: 0 };
        }
        
        const brandNode = iGroupData[brand];
        
        let itemKey = '';
        let itemName = '';
        
        if (!isAirframe) {
          itemKey = 'parts_total';
          itemName = '[ 파츠 종합 ]';
        } else {
          itemKey = pName;
          itemName = pName;
        }
        
        if (!brandNode.items[itemKey]) {
          brandNode.items[itemKey] = { name: itemName, isAirframe, quantity: 0, amount: 0 };
        }
        
        brandNode.items[itemKey].quantity += qty;
        brandNode.items[itemKey].amount += amt;
        
        brandNode.totalQty += qty;
        brandNode.totalAmt += amt;
      }
    });
    
    const invArr = Object.values(iGroupData).map(b => ({
      ...b,
      itemsArr: Object.values(b.items).sort((i1, i2) => {
         if (i1.isAirframe && !i2.isAirframe) return -1;
         if (!i1.isAirframe && i2.isAirframe) return 1;
         return i2.amount - i1.amount;
      })
    })).sort((a,b) => b.totalAmt - a.totalAmt);

    return {
      comprehensiveSalesGroups: salesArr,
      comprehensiveInventoryGroups: invArr
    };
  }, [currentFiltered, agenciesList, inventoryList]);`;

const uiStartStr = `<TableHead>
                      <TableRow>
                        <TableCell width="15%">브랜드</TableCell>
                        <TableCell width="20%">매출 구분</TableCell>
                        <TableCell width="15%">세부 채널</TableCell>
                        <TableCell width="30%">상품명 (기종-색상 / 파츠)</TableCell>
                        <TableCell width="10%">수량</TableCell>
                        <TableCell width="10%">판매 금액</TableCell>
                      </TableRow>
                    </TableHead>`;

const uiEndStr = `                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>`;

const newUI = `<TableHead>
                      <TableRow>
                        <TableCell width="20%">매출 구분 (고객유형)</TableCell>
                        <TableCell width="20%">브랜드</TableCell>
                        <TableCell width="40%">상품명 (기종-색상 / 파츠)</TableCell>
                        <TableCell width="10%">수량</TableCell>
                        <TableCell width="10%">판매 금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comprehensiveSalesGroups.length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>조회된 매출 데이터가 없습니다.</TableCell></TableRow>
                      ) : (
                        comprehensiveSalesGroups.map((t, tIdx) => {
                          const typeRowSpan = t.brandsArr.reduce((sum, b) => sum + b.itemsArr.length + 1, 0); // +1 for brand subtotal
                          
                          return t.brandsArr.map((b, bIdx) => {
                            const brandRowSpan = b.itemsArr.length + 1; // +1 for subtotal
                            
                            return (
                              <React.Fragment key={\`\${tIdx}-\${bIdx}\`}>
                                {b.itemsArr.map((item, iIdx) => (
                                  <TableRow key={\`\${tIdx}-\${bIdx}-\${iIdx}\`} hover>
                                    {bIdx === 0 && iIdx === 0 && (
                                      <TableCell rowSpan={typeRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                        {t.customerType}
                                      </TableCell>
                                    )}
                                    {iIdx === 0 && (
                                      <TableCell rowSpan={brandRowSpan} align="center" sx={{ fontWeight: 'bold', borderRight: '1px solid #cfd8dc' }}>
                                        {b.brand}
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
                                {/* 브랜드별 소계 행 */}
                                <TableRow sx={{ bgcolor: '#f1f8e9' }}>
                                  <TableCell sx={{ fontWeight: 'bold', color: '#33691e', fontSize: '0.8rem' }} align="right">[{b.brand} 소계]</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 'bold', color: '#33691e' }}>{b.subtotalQty}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#33691e' }}>{formatCurrency(b.subtotalAmt)}</TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          });
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>`;

const useMemoIdx1 = code.indexOf(useMemoStartStr);
const useMemoIdx2 = code.indexOf(useMemoEndStr);
if (useMemoIdx1 !== -1 && useMemoIdx2 !== -1) {
  code = code.substring(0, useMemoIdx1) + newUseMemoLogic + code.substring(useMemoIdx2 + useMemoEndStr.length);
} else {
  console.error('useMemo block not found');
  process.exit(1);
}

const uiIdx1 = code.indexOf(uiStartStr);
const uiIdx2 = code.indexOf(uiEndStr);
if (uiIdx1 !== -1 && uiIdx2 !== -1) {
  code = code.substring(0, uiIdx1) + newUI + code.substring(uiIdx2 + uiEndStr.length);
} else {
  console.error('UI block not found');
  process.exit(1);
}

fs.writeFileSync('src/components/Stats/SalesHistoryStats.jsx', code);
console.log('Hierarchy updated successfully.');
