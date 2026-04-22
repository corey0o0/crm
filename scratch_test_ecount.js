const row = {
  '수량': 8,
  '단가': 720000,
  '공급가액': 5760000,
  '부가세': 576000,
  '합계': 6336000
};

const price = Number(row['단가'] || 0);
const supply = Number(row['공급가액'] || row['공급가'] || 0);
const vat = Number(row['부가세'] || row['세액'] || 0);
const total = Number(row['합계'] || row['합계금액'] || row['총액'] || (supply + vat) || (price * qty));
console.log(total);
