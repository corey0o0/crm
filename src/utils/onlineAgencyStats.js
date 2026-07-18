import { getBrandFallback } from '../components/Stats/SalesHistoryStats';
import { normalizeAirframeModelName } from './airframeModelNormalize';

const CANCEL_STATUSES = ['C11', 'C34', 'C36', 'C40', 'C47', 'C48', 'C49', 'R34', 'R36', 'R40', 'E40'];

const isValidItem = (it) => !CANCEL_STATUSES.includes(it.order_status) || Number(it.payment_amount || 0) > 0;

// OnlineStats.jsx의 기체 모델명 산출 로직과 동일 (옵션 색상 반영) → 이후 표준 기종키로 정규화
const resolveAirframeModelName = (p, item) => {
  let modelName = p?.name || item.name || item.product_name || '알 수 없는 기체';
  if (item.options) {
    const colorMatch = item.options.match(/색상=([^,]+)/);
    if (colorMatch) {
      const extractedColor = colorMatch[1].trim();
      if (modelName.includes(' - ')) {
        modelName = modelName.split(' - ')[0];
      }
      if (!modelName.replace(/\s/g, '').includes(extractedColor.replace(/\s/g, ''))) {
        modelName += ` (${extractedColor})`;
      }
    }
  }
  return normalizeAirframeModelName(modelName);
};

/**
 * cafe24_orders를 대리점별로 집계한다. OnlineStats.jsx의 주문당 실결제금액 -> 아이템별
 * 비율 배분 로직(할인/취소/교환 처리 포함)을 그대로 이식한 것으로, OnlineStats.jsx와
 * 항상 동일한 숫자를 내야 한다 - 이 파일을 수정하면 OnlineStats.jsx도 다시 확인할 것.
 * 입력으로 받은 orders/order_items 객체는 절대 변형하지 않는다(다른 화면에서 같은
 * 배열을 동시에 쓰는 경우를 대비).
 *
 * 반환값의 agencyModelStats는 대리점별 x 기체 모델명별 판매 집계
 * ({ [agencyName]: { [modelName]: { qty, amount } } })
 * agencyPartsStats는 대리점별 x 파츠 상품명별 집계 (상세 모달용)
 * ({ [agencyName]: { [partName]: { qty, amount } } })
 */
export function computeOnlineAgencyStats({ orders = [], agencies = [], parts = [], brand = '전체' }) {
  const agencyMap = {};
  agencies.forEach(a => { agencyMap[a.id] = a.name; });

  const partMapById = {};
  const partMapByCode = {};
  const partMapByName = {};
  parts.forEach(p => {
    partMapById[p.id] = p;
    if (p.code) partMapByCode[String(p.code).trim()] = p;
    if (p.barcode) partMapByCode[String(p.barcode).trim()] = p;
    if (p.name) partMapByName[p.name] = p;
  });

  const resolveBrandOnline = (partId, code, fallbackName, mallId) => {
    let name = fallbackName;
    if (partId && partMapById[partId]?.name) name = partMapById[partId].name;
    else if (code && partMapByCode[code]?.name) name = partMapByCode[code].name;
    let b = '';
    if (partId && partMapById[partId]?.brand) b = partMapById[partId].brand;
    else if (code && partMapByCode[code]?.brand) b = partMapByCode[code].brand;
    else if (name && partMapByName[name]?.brand) b = partMapByName[name].brand;
    return getBrandFallback(b, name, code, mallId);
  };

  const agencyStats = {};
  const agencyModelStats = {};
  const agencyPartsStats = {};

  orders.forEach(o => {
    const orderItems = o.order_items || [];
    // 창고 정보 없는 건(반영 예외 처리된 건) 제외 - SalesHistory/SalesHistoryStats와 동일 기준
    if (orderItems.length > 0 && !orderItems.some(item => item._warehouse_id)) return;

    const agName = o.agency_id ? (agencyMap[o.agency_id] || '미등록 대리점') : '일반 주문';
    if (!agencyStats[agName]) agencyStats[agName] = { amount: 0, count: 0, airframe: 0, airframeAmount: 0, parts: 0, partsAmount: 0 };

    // 교환/취소 상태여도 실결제(payment_amount>0)가 있으면 유효 거래로 인정 (예: 교환 차액 결제)
    const validItems = orderItems.filter(isValidItem);
    if (validItems.length === 0) return; // 전액 취소건은 제외

    const canceledItems = orderItems.filter(it => !isValidItem(it));
    const canceledAmount = canceledItems.reduce((acc, it) => {
      if (it.payment_amount !== undefined && it.payment_amount !== null) return acc + Number(it.payment_amount);
      const cp = it.product_price !== undefined && it.product_price !== null ? Number(it.product_price) : (it.price !== undefined && it.price !== null ? Number(it.price) : 0);
      return acc + (cp * Number(it.quantity || 1));
    }, 0);

    // 선불금 처리: total_amount=0 -> payment_amount 합계 -> used_points 순으로 폴백
    const itemPaySum = validItems.reduce((acc, i) => acc + Number(i.payment_amount || 0), 0);
    const isNearbikeMemberDiscount = String(o.order_id || '').startsWith('nearbike_') && Number(o.total_amount || 0) === 0;
    const itemPayMethod = (validItems[0]?.payment_method || '').toLowerCase();
    const isChunbulgeum = itemPayMethod.includes('선불금');
    const effTotal = !isNearbikeMemberDiscount && Number(o.total_amount || 0) === 0
      ? itemPaySum > 0 ? itemPaySum
        : isChunbulgeum && Number(o.used_points || 0) > 0 ? Number(o.used_points)
        : 0
      : Number(o.total_amount || 0);
    const distributableAmount = Math.max(0, effTotal - Number(o.shipping_fee || 0) - canceledAmount);

    // item._fallbackWeight를 캐시하는 대신, validItems 인덱스에 대응하는 로컬 배열을 쓴다
    // (호출자가 준 order 객체를 절대 변형하지 않기 위함)
    const fallbackWeights = new Array(validItems.length).fill(undefined);

    let totalWeight = validItems.reduce((acc, i) => {
      let w = 0;
      if (i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) > 0) {
        w = Number(i.payment_amount);
      } else if (!(i.payment_amount !== undefined && i.payment_amount !== null && Number(i.payment_amount) === 0)) {
        const pCode = String(i.custom_product_code || i.product_code || '').trim();
        const p = i.part_id ? partMapById[i.part_id] : (pCode ? partMapByCode[pCode] : null);
        const pPrice = i.product_price !== undefined && i.product_price !== null ? Number(i.product_price) : (i.price !== undefined && i.price !== null ? Number(i.price) : Number(p ? p.price : 0));
        w = pPrice * Number(i.quantity || 1);
      }
      return acc + w;
    }, 0);

    if (totalWeight === 0 && distributableAmount > 0) {
      validItems.forEach((i, idx) => {
        const pCode = String(i.custom_product_code || i.product_code || '').trim();
        const p = i.part_id ? partMapById[i.part_id] : (pCode ? partMapByCode[pCode] : null);
        fallbackWeights[idx] = Number(p ? p.price : 0) * Number(i.quantity || 1);
        totalWeight += fallbackWeights[idx];
      });
      if (totalWeight === 0) {
        validItems.forEach((i, idx) => {
          fallbackWeights[idx] = Number(i.quantity || 1);
          totalWeight += fallbackWeights[idx];
        });
      }
    }

    let orderTotalForBrand = 0;
    let hasMatchingBrand = false;
    const seenProductCodes = new Set();

    validItems.forEach((item, idx) => {
      const pCode = String(item.custom_product_code || item.product_code || '').trim();
      const p = item.part_id ? partMapById[item.part_id] : (pCode ? partMapByCode[pCode] : null);
      const pName = item.product_name || item.name || '상품';
      const qty = Number(item.quantity || 1);

      const pCodeCheck = (String(item.product_code || '') + '_' + String(item.custom_product_code || '') + '_' + String(item.option_value || item.options || '')).trim();
      let statQty = qty;
      if (pCodeCheck !== '__') {
        if (seenProductCodes.has(pCodeCheck)) statQty = 0;
        else seenProductCodes.add(pCodeCheck);
      }

      let baseWeight = 0;
      if (fallbackWeights[idx] !== undefined) {
        baseWeight = fallbackWeights[idx];
      } else {
        const isExplicitlyZero = item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) === 0;
        if (item.payment_amount !== undefined && item.payment_amount !== null && Number(item.payment_amount) > 0) {
          baseWeight = Number(item.payment_amount);
        } else if (!isExplicitlyZero) {
          const pPrice = item.product_price !== undefined && item.product_price !== null ? Number(item.product_price) : (item.price !== undefined && item.price !== null ? Number(item.price) : Number(p ? p.price : 0));
          baseWeight = pPrice * qty;
        }
      }

      let amount = 0;
      if (totalWeight > 0) {
        amount = Math.floor((baseWeight / totalWeight) * distributableAmount);
        if (idx === validItems.length - 1) {
          const prevTotal = validItems.slice(0, validItems.length - 1).reduce((acc, prev, prevIdx) => {
            let prevW = 0;
            if (fallbackWeights[prevIdx] !== undefined) {
              prevW = fallbackWeights[prevIdx];
            } else {
              if (prev.payment_amount !== undefined && prev.payment_amount !== null && Number(prev.payment_amount) > 0) {
                prevW = Number(prev.payment_amount);
              } else if (!(prev.payment_amount !== undefined && prev.payment_amount !== null && Number(prev.payment_amount) === 0)) {
                const prevPCode = String(prev.custom_product_code || prev.product_code || '').trim();
                const prevP = prev.part_id ? partMapById[prev.part_id] : (prevPCode ? partMapByCode[prevPCode] : null);
                const prevPrice = prev.product_price !== undefined && prev.product_price !== null ? Number(prev.product_price) : (prev.price !== undefined && prev.price !== null ? Number(prev.price) : Number(prevP ? prevP.price : 0));
                prevW = prevPrice * Number(prev.quantity || 1);
              }
            }
            return acc + Math.floor((prevW / totalWeight) * distributableAmount);
          }, 0);
          amount = distributableAmount - prevTotal;
        }
      } else if (distributableAmount > 0) {
        amount = Math.floor(distributableAmount / validItems.length);
        if (idx === validItems.length - 1) {
          amount = distributableAmount - (amount * (validItems.length - 1));
        }
      }

      const isAirframe = p ? (p.note?.includes('기체')) : (pName.includes('기체') || pName.includes('차체') || pName.includes('완차') || pName.includes('스쿠터') || pName.includes('전기자전거'));
      const sup = resolveBrandOnline(item.part_id, pCode, pName, o.mall_id);

      if (brand !== '전체' && sup !== brand) return; // 현재 선택된 브랜드가 아니면 패스

      // 취소된 항목은 통계 집계에서 제외 (단, 실결제 payment_amount>0인 교환건은 정상 매출로 포함)
      const isCancelled = CANCEL_STATUSES.includes(item.order_status) && !(Number(item.payment_amount || 0) > 0);
      if (isCancelled) return;

      hasMatchingBrand = true;
      orderTotalForBrand += amount;

      if (isAirframe) {
        agencyStats[agName].airframe += statQty;
        agencyStats[agName].airframeAmount += amount;

        const modelName = resolveAirframeModelName(p, item);
        if (!agencyModelStats[agName]) agencyModelStats[agName] = {};
        if (!agencyModelStats[agName][modelName]) agencyModelStats[agName][modelName] = { qty: 0, amount: 0 };
        agencyModelStats[agName][modelName].qty += statQty;
        agencyModelStats[agName][modelName].amount += amount;
      } else {
        agencyStats[agName].parts += statQty;
        agencyStats[agName].partsAmount += amount;

        const partKey = (p?.name || pName || '기타 파츠').trim() || '기타 파츠';
        if (!agencyPartsStats[agName]) agencyPartsStats[agName] = {};
        if (!agencyPartsStats[agName][partKey]) agencyPartsStats[agName][partKey] = { qty: 0, amount: 0 };
        agencyPartsStats[agName][partKey].qty += statQty;
        agencyPartsStats[agName][partKey].amount += amount;
      }
    });

    if (hasMatchingBrand) {
      const shipFee = Number(o.shipping_fee || 0);
      // brand === '전체'일 때는 orderTotalForBrand가 곧 주문의 유효 결제 총액과 같다
      // (모든 유효 아이템이 필터를 통과하므로) - OnlineStats.jsx의 o._validOrderTotal과 동일한 값
      if (brand === '전체') {
        agencyStats[agName].amount += orderTotalForBrand + shipFee;
        agencyStats[agName].count += 1;
      } else {
        // orderTotalForBrand는 이 주문의 유효 결제 총액(OnlineStats.jsx의 o._validOrderTotal)과 항상 같으므로
        // 배분 비율은 항상 1 - 유효 결제가 있는 주문이면 배송비 전액을 배분한다
        const apportionedShipping = orderTotalForBrand > 0 ? shipFee : 0;
        agencyStats[agName].amount += orderTotalForBrand + apportionedShipping;
        agencyStats[agName].count += 1;
      }
    }
  });

  return { agencyStats, agencyModelStats, agencyPartsStats };
}
