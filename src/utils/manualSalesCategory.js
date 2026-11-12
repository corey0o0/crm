export const MANUAL_SALES_CATEGORIES = ['기체', '부품·용품', '공임', '기타'];

export const getManualSalesCategory = (value) => (
  MANUAL_SALES_CATEGORIES.includes(value) ? value : '미분류'
);

// 분류만 수정할 때는 기존 출고의 재고 복구/재차감 경로를 실행하지 않는다.
export const isManualCategoryOnlyChange = (shipmentData, selectedParts, initialData) => {
  if (!initialData || shipmentData.revenue_category === initialData.shipmentData.revenue_category) return false;
  const withoutCategory = ({ revenue_category, ...data }) => data;
  const partSnapshot = (parts) => parts.map(({ part_name, part_code, category, quantity, price, totalPrice }) => (
    { part_name, part_code, category, quantity, price, totalPrice }
  ));
  return JSON.stringify(withoutCategory(shipmentData)) === JSON.stringify(withoutCategory(initialData.shipmentData))
    && JSON.stringify(partSnapshot(selectedParts)) === JSON.stringify(partSnapshot(initialData.selectedParts));
};
