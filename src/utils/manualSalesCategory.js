export const MANUAL_SALES_CATEGORIES = ['기체', '부품·용품', '공임', '기타'];

export const getManualSalesCategory = (value, legacyValue) => {
  const normalize = (category) => ['파츠', '부품'].includes(category) ? '부품·용품' : category;
  const category = normalize(value);
  if (MANUAL_SALES_CATEGORIES.includes(category)) return category;
  const legacyCategory = normalize(legacyValue);
  return MANUAL_SALES_CATEGORIES.includes(legacyCategory) ? legacyCategory : '미분류';
};

export const manualSalesPartSnapshot = (parts) => parts.map(({ id, part_name, part_code, category, quantity, price, totalPrice }) => (
  { id, part_name, part_code, category, quantity, price, totalPrice }
));

// 구분만 수정할 때는 기존 출고의 재고 복구/재차감 경로를 실행하지 않는다.
export const isManualCategoryOnlyChange = (shipmentData, selectedParts, initialData) => {
  if (!initialData || JSON.stringify(shipmentData) !== JSON.stringify(initialData.shipmentData)) return false;
  const before = manualSalesPartSnapshot(initialData.selectedParts);
  const after = manualSalesPartSnapshot(selectedParts);
  const withoutCategory = (parts) => parts.map(({ category, ...part }) => part);
  return after.length > 0 && after.every(part => part.id != null)
    && JSON.stringify(withoutCategory(before)) === JSON.stringify(withoutCategory(after));
};
