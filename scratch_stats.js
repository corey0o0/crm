const fs = require('fs');

let code = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

// I will locate the start of useMemo
const useMemoStart = code.indexOf('const { reportGroups');
const useMemoEnd = code.indexOf('  return (', useMemoStart);

if (useMemoStart === -1 || useMemoEnd === -1) {
  console.error("Could not find useMemo block");
  process.exit(1);
}

const newUseMemo = `  // 개편된 보고서용 다차원 그룹화 로직 (브랜드별, 채널별 종합)
  const { comprehensiveSalesGroups, comprehensiveInventoryGroups } = React.useMemo(() => {
    // 1. 판매 매출 그룹화
    // 구조: Brand -> Channel -> SubChannel -> ItemKey -> { qty, amount }
    const sGroupData = {};
    
    currentFiltered.forEach(r => {
      let brand = r.part_brand || '기타';
      if (brand === '-') brand = '기타';
      
      const ch = r.sales_channel || '';
      
      // 대분류 (Channel) 및 중분류 (SubChannel)
      let channel = '';
      let subChannel = '';
      
      if (r._type === 'cafe24' || ch === '온라인주문') {
        channel = '온라인 매출';
        // agenciesList에 속하거나 '대리점' 단어가 있으면 대리점, 아니면 일반고객
        if (agenciesList.some(a => r.customer_name?.includes(a) || r.sales_channel?.includes(a)) || ch.includes('대리점')) {
          subChannel = '대리점';
        } else {
          subChannel = '일반고객';
        }
      } else if (r._type === 'service') {
        channel = 'A/S 매출';
        subChannel = '-';
      } else {
        channel = '매장 판매';
        subChannel = '매장출고';
      }
      
      // 기체 vs 파츠 분류
      const pName = r.part_name || '상품';
      const isAirframe = r.part_category === '기체';
      const isService = r._type === 'service';
      
      const qty = Number(r.quantity || 0);
      const amt = Number(r.total_price || 0);

      if (!sGroupData[brand]) {
        sGroupData[brand] = { brand, channels: {}, totalQty: 0, totalAmt: 0 };
      }
      
      const brandNode = sGroupData[brand];
      if (!brandNode.channels[channel]) {
        brandNode.channels[channel] = { channel, subChannels: {}, subtotalQty: 0, subtotalAmt: 0 };
      }
      
      const channelNode = brandNode.channels[channel];
      if (!channelNode.subChannels[subChannel]) {
        channelNode.subChannels[subChannel] = { subChannel, items: {}, subtotalQty: 0, subtotalAmt: 0 };
      }
      
      const subChannelNode = channelNode.subChannels[subChannel];
      
      let itemKey = '';
      let itemName = '';
      
      if (isService) {
        // A/S는 파츠/기체 상관없이 무조건 1건으로 묶기 위해
        itemKey = 'as_total';
        itemName = 'A/S 처리 (공임/부품 포함)';
      } else if (!isAirframe) {
        itemKey = 'parts_total';
        itemName = '[ 파츠 총합 ]';
      } else {
        // 기체의 경우 단가를 포함하여 구분할지, 이름만으로 할지 결정
        itemKey = pName;
        itemName = pName;
      }
      
      if (!subChannelNode.items[itemKey]) {
         subChannelNode.items[itemKey] = { name: itemName, isAirframe, isService, quantity: 0, amount: 0 };
      }
      
      subChannelNode.items[itemKey].quantity += qty;
      subChannelNode.items[itemKey].amount += amt;
      
      subChannelNode.subtotalQty += qty;
      subChannelNode.subtotalAmt += amt;
      channelNode.subtotalQty += qty;
      channelNode.subtotalAmt += amt;
      brandNode.totalQty += qty;
      brandNode.totalAmt += amt;
    });

    // 객체를 배열로 변환하고 정렬
    const salesArr = Object.values(sGroupData).map(b => ({
      ...b,
      channelsArr: Object.values(b.channels).map(c => ({
        ...c,
        subChannelsArr: Object.values(c.subChannels).map(sc => ({
          ...sc,
          itemsArr: Object.values(sc.items).sort((i1, i2) => {
             // 기체 먼저, 그 다음 파츠
             if (i1.isService) return 1;
             if (i2.isService) return -1;
             if (i1.isAirframe && !i2.isAirframe) return -1;
             if (!i1.isAirframe && i2.isAirframe) return 1;
             return i2.amount - i1.amount;
          })
        }))
      }))
    })).sort((a,b) => b.totalAmt - a.totalAmt);

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
  }, [currentFiltered, agenciesList, inventoryList]);
`;

code = code.substring(0, useMemoStart) + newUseMemo + code.substring(useMemoEnd);

fs.writeFileSync('src/components/Stats/SalesHistoryStats.jsx', code);
console.log('useMemo logic patched successfully.');
