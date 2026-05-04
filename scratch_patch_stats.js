const fs = require('fs');
const path1 = './src/components/Stats/SalesHistoryStats.jsx';
let content1 = fs.readFileSync(path1, 'utf8');

// 1. SalesHistoryStats.jsx: Add original_channel
content1 = content1.replace(
  /sales_channel: isManual \? '수기판매' : \(s\.sales_channel \|\| '매장출고'\), customer_name: s\.customer_name \|\| '-'/g,
  `sales_channel: isManual ? '수기판매' : (s.sales_channel || '매장출고'), original_channel: s.sales_channel, customer_name: s.customer_name || '-'`
);

// 2. SalesHistoryStats.jsx: Update isAgency check
content1 = content1.replace(
  /const isAgency = agenciesList\.some\(a => r\.customer_name\?\.includes\(a\) \|\| r\.sales_channel\?\.includes\(a\)\) \|\| ch\.includes\('대리점'\);/g,
  `const isAgency = agenciesList.some(a => r.customer_name?.includes(a) || r.sales_channel?.includes(a) || r.original_channel?.includes(a)) || ch.includes('대리점') || (r.original_channel && r.original_channel.includes('대리점'));`
);
content1 = content1.replace(
  /const isAgency = r\.sales_channel && !\['고객', '-', '일반출고\(공홈\)', '온라인주문', '매장출고', '청담매장', '기타', '본점'\]\.includes\(r\.sales_channel\) && \(agenciesList\.includes\(r\.sales_channel\) \|\| r\.sales_channel\?\.includes\('대리점'\)\);/g,
  `const isAgency = (r.sales_channel && !['고객', '-', '일반출고(공홈)', '온라인주문', '매장출고', '청담매장', '기타', '본점'].includes(r.sales_channel) && (agenciesList.includes(r.sales_channel) || r.sales_channel?.includes('대리점'))) || (r.original_channel && (agenciesList.includes(r.original_channel) || r.original_channel.includes('대리점')));`
);

// 3. SalesHistoryStats.jsx: fetchTotalsForRange shipping fee apportionment
content1 = content1.replace(
  `// Include shipping fee in brand total only if brand matches the primary mall brand
               if (getBrandFallback('', '', '', o.mall_id) === targetBrand) {
                  cafeTotal += Number(o.shipping_fee || 0);
               }`,
  `// 비율에 따른 배송비 배분
               if (orderItemsSum > 0) {
                  cafeTotal += Math.floor(Number(o.shipping_fee || 0) * (brandMatchedAmount / orderItemsSum));
               }`
);

// 4. SalesHistoryStats.jsx: chart data generation shipping fee apportionment
const oldShipFeeCode = `        if (shipFee > 0) {
          rows.push({
            ...baseFields,
            part_name: '배송비',
            part_category: '기타',
            part_brand: orderBrand,
            quantity: 1,
            total_price: shipFee,
            total_cost: 0
          });
        }
        
        if (displayUsedPoints > 0) {
          rows.push({
            ...baseFields,
            part_name: '적립금 사용(할인)',
            part_category: '기타',
            part_brand: orderBrand,
            quantity: 1,
            total_price: -displayUsedPoints,
            total_cost: 0
          });
        }`;

const newShipFeeCode = `        if (shipFee > 0) {
           const brandTotals = {};
           orderRows.forEach(r => {
              if (!brandTotals[r.part_brand]) brandTotals[r.part_brand] = 0;
              brandTotals[r.part_brand] += r.total_price;
           });
           
           let remainingShipFee = shipFee;
           const brands = Object.keys(brandTotals);
           brands.forEach((br, idx) => {
              if (orderItemsSum > 0) {
                 let apportioned = Math.floor(shipFee * (brandTotals[br] / orderItemsSum));
                 if (idx === brands.length - 1) apportioned = remainingShipFee;
                 
                 if (apportioned > 0) {
                    rows.push({
                      ...baseFields,
                      part_name: '배송비',
                      part_category: '기타',
                      part_brand: br,
                      quantity: 1,
                      total_price: apportioned,
                      total_cost: 0
                    });
                 }
                 remainingShipFee -= apportioned;
              }
           });
           if (orderItemsSum === 0) {
              rows.push({ ...baseFields, part_name: '배송비', part_category: '기타', part_brand: orderBrand, quantity: 1, total_price: shipFee, total_cost: 0 });
           }
        }
        
        if (displayUsedPoints > 0) {
           const brandTotals = {};
           orderRows.forEach(r => {
              if (!brandTotals[r.part_brand]) brandTotals[r.part_brand] = 0;
              brandTotals[r.part_brand] += r.total_price;
           });
           
           let remainingPoints = displayUsedPoints;
           const brands = Object.keys(brandTotals);
           brands.forEach((br, idx) => {
              if (orderItemsSum > 0) {
                 let apportioned = Math.floor(displayUsedPoints * (brandTotals[br] / orderItemsSum));
                 if (idx === brands.length - 1) apportioned = remainingPoints;
                 
                 if (apportioned > 0) {
                    rows.push({
                      ...baseFields,
                      part_name: '적립금 사용(할인)',
                      part_category: '기타',
                      part_brand: br,
                      quantity: 1,
                      total_price: -apportioned,
                      total_cost: 0
                    });
                 }
                 remainingPoints -= apportioned;
              }
           });
           if (orderItemsSum === 0) {
              rows.push({ ...baseFields, part_name: '적립금 사용(할인)', part_category: '기타', part_brand: orderBrand, quantity: 1, total_price: -displayUsedPoints, total_cost: 0 });
           }
        }`;

content1 = content1.replace(oldShipFeeCode, newShipFeeCode);
fs.writeFileSync(path1, content1, 'utf8');

// ----------------------------------------------------
// 5. OnlineStats.jsx: Shipping fee distribution
const path2 = './src/components/Stats/OnlineStats.jsx';
let content2 = fs.readFileSync(path2, 'utf8');

const oldOnlineTotalCode = `          if (hasMatchingBrand) {
              const validOrderTotal = (o._validOrderTotal || 0) + Number(o.shipping_fee || 0);
              
              if (qBrand === '전체') {
                 total += validOrderTotal;
                 if (agencyStats[agName]) {
                    agencyStats[agName].amount += validOrderTotal;
                    agencyStats[agName].count += 1;
                 }
              } else {
                 total += orderTotalForBrand;
                 if (agencyStats[agName]) {
                    agencyStats[agName].amount += orderTotalForBrand;
                    agencyStats[agName].count += 1;
                 }
              }
              filteredOrderCount += 1;
              filteredList.push(o);
           }`;

const newOnlineTotalCode = `          if (hasMatchingBrand) {
              const validOrderTotal = (o._validOrderTotal || 0) + Number(o.shipping_fee || 0);
              
              if (qBrand === '전체') {
                 total += validOrderTotal;
                 if (agencyStats[agName]) {
                    agencyStats[agName].amount += validOrderTotal;
                    agencyStats[agName].count += 1;
                 }
              } else {
                 const apportionedShipping = (o._validOrderTotal > 0) ? Math.floor(Number(o.shipping_fee || 0) * (orderTotalForBrand / o._validOrderTotal)) : 0;
                 const adjustedTotalForBrand = orderTotalForBrand + apportionedShipping;
                 total += adjustedTotalForBrand;
                 if (agencyStats[agName]) {
                    agencyStats[agName].amount += adjustedTotalForBrand;
                    agencyStats[agName].count += 1;
                 }
              }
              filteredOrderCount += 1;
              filteredList.push(o);
           }`;

content2 = content2.replace(oldOnlineTotalCode, newOnlineTotalCode);

// 6. OnlineStats.jsx: Monthly stats distribution
const oldMonthlyLoop = `            validItems.forEach((item, idx) => {
               const qty = Number(item.quantity || 1);
               let amount = 0;
               if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
                   amount = Number(item.payment_amount);
               } else {
                   const canceledItems = items.filter(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
                   const canceledAmount = canceledItems.reduce((acc, it) => acc + (Number(it.product_price || it.price || 0) * Number(it.quantity || 1)), 0);
                   const distributableAmount = Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fee || 0) - canceledAmount);
                   
                   if (totalWeight > 0) {
                       const pPrice = Number(item.product_price || item.price || 0);
                       amount = Math.floor(((pPrice * qty) / totalWeight) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               return acc + Math.floor(((Number(prev.product_price || prev.price || 0) * Number(prev.quantity || 1)) / totalWeight) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   } else if (totalQty > 0) {
                       amount = Math.floor((qty / totalQty) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               return acc + Math.floor((Number(prev.quantity || 1) / totalQty) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   }
               }
               orderItemsSum += amount;
            });
            const validOrderTotal = orderItemsSum + Number(o.shipping_fee || 0);

            const m = new Date(o.order_date).getMonth() + 1;
            monthlyMap[m].sales += validOrderTotal;`;

const newMonthlyLoop = `            let brandMatchedAmount = 0;
            validItems.forEach((item, idx) => {
               const pName = item.name || item.product_name || '';
               const pCode = String(item.custom_product_code || item.product_code || '').trim();
               const isAirframe = pName.includes('기체') || pName.includes('차체');
               let itemBrand = '';
               if (o.mall_id === 'slimpack79') itemBrand = 'XRB';
               else if (o.mall_id === 'nearbike') itemBrand = 'NB';
               else itemBrand = '기타 브랜드';

               const qty = Number(item.quantity || 1);
               let amount = 0;
               if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
                   amount = Number(item.payment_amount);
               } else {
                   const canceledItems = items.filter(it => ['C11', 'C40', 'R40', 'E40'].includes(it.order_status));
                   const canceledAmount = canceledItems.reduce((acc, it) => acc + (Number(it.product_price || it.price || 0) * Number(it.quantity || 1)), 0);
                   const distributableAmount = Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fee || 0) - canceledAmount);
                   
                   if (totalWeight > 0) {
                       const pPrice = Number(item.product_price || item.price || 0);
                       amount = Math.floor(((pPrice * qty) / totalWeight) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               return acc + Math.floor(((Number(prev.product_price || prev.price || 0) * Number(prev.quantity || 1)) / totalWeight) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   } else if (totalQty > 0) {
                       amount = Math.floor((qty / totalQty) * distributableAmount);
                       if (idx === validItems.length - 1) {
                           const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev) => {
                               return acc + Math.floor((Number(prev.quantity || 1) / totalQty) * distributableAmount);
                           }, 0);
                           amount = distributableAmount - prevTotal;
                       }
                   }
               }
               orderItemsSum += amount;
               if (qBrand === '전체' || itemBrand === qBrand) {
                   brandMatchedAmount += amount;
               }
            });
            
            let finalMonthlyAmt = 0;
            if (qBrand === '전체') {
                finalMonthlyAmt = orderItemsSum + Number(o.shipping_fee || 0);
            } else {
                const apportionedShipping = (orderItemsSum > 0) ? Math.floor(Number(o.shipping_fee || 0) * (brandMatchedAmount / orderItemsSum)) : 0;
                finalMonthlyAmt = brandMatchedAmount + apportionedShipping;
            }

            if (finalMonthlyAmt > 0) {
                const m = new Date(o.order_date).getMonth() + 1;
                monthlyMap[m].sales += finalMonthlyAmt;
            }`;

// we need to remove the two "return" statements at the top of the loop for monthly calculation
// so that mixed orders are processed even if the mall_id doesn't match the primary brand
content2 = content2.replace(
  `            if (qBrand === 'XRB' && o.mall_id !== 'slimpack79') return;
            if (qBrand === 'NB' && o.mall_id !== 'nearbike') return;`,
  `            // 혼합 주문 처리를 위해 mall_id 기반 필터링은 제거하고, 아이템별로 검사`
);

content2 = content2.replace(oldMonthlyLoop, newMonthlyLoop);

fs.writeFileSync(path2, content2, 'utf8');

console.log('Done patching stats.');
