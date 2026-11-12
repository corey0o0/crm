import assert from 'node:assert/strict';
import { MANUAL_SALES_CATEGORIES, getManualSalesCategory, isManualCategoryOnlyChange } from '../src/utils/manualSalesCategory.js';

assert.deepEqual(MANUAL_SALES_CATEGORIES, ['기체', '부품·용품', '공임', '기타']);
assert.equal(getManualSalesCategory('기체'), '기체');
assert.equal(getManualSalesCategory('부품·용품'), '부품·용품');
assert.equal(getManualSalesCategory('없는분류'), '미분류');
assert.equal(getManualSalesCategory(null), '미분류');

const baseShipment = { customer_name: '홍길동', warehouse_id: 'W1', revenue_category: '기체' };
const initialShipment = { customer_name: '홍길동', warehouse_id: 'W1', revenue_category: '기타' };
const parts = [{ part_name: '개인결제건', part_code: '', category: '기타', quantity: 1, price: 100000, totalPrice: 100000 }];

assert.equal(
  isManualCategoryOnlyChange(baseShipment, parts, { shipmentData: initialShipment, selectedParts: parts }),
  true
);

assert.equal(
  isManualCategoryOnlyChange(
    { ...baseShipment, customer_name: '김철수' },
    parts,
    { shipmentData: initialShipment, selectedParts: parts }
  ),
  false
);

console.log('manualSalesCategory tests passed');
