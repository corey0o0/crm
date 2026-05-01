const fs = require('fs');

let code = fs.readFileSync('src/components/Stats/OnlineStats.jsx', 'utf8');

// 1. Add _resolvedName to item in fetchData
const oldModelNameLogic = `if (isAirframe) {
                     let modelName = p.name || item.name || '알 수 없는 기체';
                     if (item.options) {
                        const colorMatch = item.options.match(/색상=([^,]+)/);
                        if (colorMatch) {
                           const extractedColor = colorMatch[1].trim();
                           
                           // 이름에 이미 ' - 색상' 형태가 포함된 경우 (예: 레트로 FS - 샌드 베이지)
                           // 베이스 모델명만 추출하여 실제 선택된 옵션 색상을 붙여줌
                           if (modelName.includes(' - ')) {
                              modelName = modelName.split(' - ')[0];
                           }
                           
                           // 만약 어떻게든 베이스 모델명에 색상이 포함되어있지 않다면 (혹은 '-' 가 없었다면)
                           if (!modelName.replace(/\\s/g, '').includes(extractedColor.replace(/\\s/g, ''))) {
                              modelName += \` (\${extractedColor})\`;
                           }
                        }
                     }
                     if (!brandStats[customerType][sup].airframes[modelName]) {
                        brandStats[customerType][sup].airframes[modelName] = { quantity: 0, amount: 0 };
                     }
                     brandStats[customerType][sup].airframes[modelName].quantity += qty;
                     brandStats[customerType][sup].airframes[modelName].amount += amount;
                     brandStats[customerType][sup].airframeTotalQty += qty;
                     brandStats[customerType][sup].airframeAmount += amount;
                } else {`;

const newModelNameLogic = `if (isAirframe) {
                     let modelName = p.name || item.name || '알 수 없는 기체';
                     if (item.options) {
                        const colorMatch = item.options.match(/색상=([^,]+)/);
                        if (colorMatch) {
                           const extractedColor = colorMatch[1].trim();
                           if (modelName.includes(' - ')) {
                              modelName = modelName.split(' - ')[0];
                           }
                           if (!modelName.replace(/\\s/g, '').includes(extractedColor.replace(/\\s/g, ''))) {
                              modelName += \` (\${extractedColor})\`;
                           }
                        }
                     }
                     item._resolvedName = modelName;
                     
                     if (!brandStats[customerType][sup].airframes[modelName]) {
                        brandStats[customerType][sup].airframes[modelName] = { quantity: 0, amount: 0 };
                     }
                     brandStats[customerType][sup].airframes[modelName].quantity += qty;
                     brandStats[customerType][sup].airframes[modelName].amount += amount;
                     brandStats[customerType][sup].airframeTotalQty += qty;
                     brandStats[customerType][sup].airframeAmount += amount;
                } else {
                     item._resolvedName = p ? p.name : (item.product_name || item.name || '상품');
                     `;

code = code.replace(oldModelNameLogic, newModelNameLogic);

// 2. Update handleOpenModal sorting and UI
const oldModalStr = `  const handleOpenModal = (title, dataFilter) => {
    setModalTitle(title);
    const items = [];
    rawOrders.forEach(o => {
      const agName = o.agency_id ? (agencyMapGlobal[o.agency_id] || '미등록 대리점') : '일반 주문';
      o.order_items?.forEach(item => {
        if (dataFilter(o, agName, item, item._isAirframe, item._brand)) {
           items.push({
             ...item,
             order_id: o.order_id,
             order_date: o.order_date,
             buyer_name: o.buyer_name,
             agency_name: agName,
             total_price: Number(item.quantity || 1) * Number(item.product_price || item.price || 0)
           });
        }
      });
    });
    setModalData(items);
    setModalOpen(true);
  };`;

const newModalStr = `  const handleOpenModal = (title, dataFilter) => {
    setModalTitle(title);
    const items = [];
    rawOrders.forEach(o => {
      const agName = o.agency_id ? (agencyMapGlobal[o.agency_id] || '미등록 대리점') : '일반 주문';
      o.order_items?.forEach(item => {
        if (dataFilter(o, agName, item, item._isAirframe, item._brand)) {
           items.push({
             ...item,
             order_id: o.order_id,
             order_date: o.order_date,
             buyer_name: o.buyer_name,
             agency_name: agName,
             total_price: Number(item.quantity || 1) * Number(item.product_price || item.price || 0)
           });
        }
      });
    });
    items.sort((a, b) => {
      if (a._isAirframe && !b._isAirframe) return -1;
      if (!a._isAirframe && b._isAirframe) return 1;
      return 0;
    });
    setModalData(items);
    setModalOpen(true);
  };`;

code = code.replace(oldModalStr, newModalStr);

// 3. Update Modal Table rendering
const oldTableBodyStr = `<TableBody>
                {modalData.length > 0 ? modalData.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.order_date ? row.order_date.split('T')[0] : ''}</TableCell>
                    <TableCell>{row.order_id}</TableCell>
                    <TableCell>{row.name || row.product_name}</TableCell>
                    <TableCell align="right">{row.quantity}개</TableCell>
                    <TableCell align="right">{formatCurrency(row.total_price)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} align="center">판매 내역이 없습니다.</TableCell></TableRow>
                )}
              </TableBody>`;

const newTableBodyStr = `<TableBody>
                {modalData.length > 0 ? modalData.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.order_date ? row.order_date.split('T')[0] : ''}</TableCell>
                    <TableCell>{row.order_id}</TableCell>
                    <TableCell>{row._resolvedName || row.name || row.product_name}</TableCell>
                    <TableCell align="right">{row.quantity}개</TableCell>
                    <TableCell align="right">{formatCurrency(row.total_price)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} align="center">판매 내역이 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow sx={{ bgcolor: 'grey.200' }}>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>기체 총합</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{modalData.filter(i => i._isAirframe).reduce((sum, i) => sum + Number(i.quantity || 1), 0)}대</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(modalData.filter(i => i._isAirframe).reduce((sum, i) => sum + i.total_price, 0))}</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: 'grey.200' }}>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>파츠 총합</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{modalData.filter(i => !i._isAirframe).reduce((sum, i) => sum + Number(i.quantity || 1), 0)}개</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(modalData.filter(i => !i._isAirframe).reduce((sum, i) => sum + i.total_price, 0))}</TableCell>
                </TableRow>
              </TableFooter>`;

code = code.replace(oldTableBodyStr, newTableBodyStr);

// Also need to add TableFooter to imports
if (!code.includes('TableFooter,')) {
  code = code.replace('TableBody,', 'TableBody,\n  TableFooter,');
}

fs.writeFileSync('src/components/Stats/OnlineStats.jsx', code);
console.log('Successfully patched OnlineStats.');
