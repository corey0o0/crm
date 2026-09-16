import { calculateSharedMallStock, isComparableProduct, findMatchedVariant } from './cafe24InventoryReconciliationUtils';

test('matches CRM stock when slimpack79 and nearbike stock sum equals CRM stock', () => {
  const result = calculateSharedMallStock({
    slimpack79: { stock: 3, use_inventory: true },
    nearbike: { stock: 7, use_inventory: true },
  }, 10);

  expect(result).toEqual({
    stock: 10,
    diff: 0,
    isMatch: true,
    status: '합산 일치',
  });
});

test('matches when only one shared mall carries the product and its stock matches', () => {
  const result = calculateSharedMallStock({
    slimpack79: { stock: 10, use_inventory: true },
    nearbike: { stock: null, use_inventory: false, status: '미연동' },
  }, 10);

  expect(result).toMatchObject({
    stock: 10,
    diff: 0,
    isMatch: true,
    status: '합산 일치',
  });
});

test('marks mismatch when the only linked shared mall stock differs from CRM stock', () => {
  const result = calculateSharedMallStock({
    slimpack79: { stock: 5, use_inventory: true },
    nearbike: { stock: null, use_inventory: false, status: '미연동' },
  }, 10);

  expect(result).toMatchObject({
    stock: 5,
    diff: -5,
    isMatch: false,
    status: '합산 불일치',
  });
});

test('marks shared stock missing when neither shared mall is linked', () => {
  const result = calculateSharedMallStock({
    slimpack79: { stock: null, use_inventory: false, status: '미연동' },
    nearbike: { stock: null, use_inventory: false, status: '미연동' },
  }, 10);

  expect(result).toMatchObject({
    isMatch: false,
    status: '미연동 (합산)',
  });
});

test('marks shared stock mismatch when the sum differs from CRM stock', () => {
  const result = calculateSharedMallStock({
    slimpack79: { stock: 2, use_inventory: true },
    nearbike: { stock: 4, use_inventory: true },
  }, 10);

  expect(result).toMatchObject({
    stock: 6,
    diff: -4,
    isMatch: false,
    status: '합산 불일치',
  });
});

test('excludes products with track_inventory false', () => {
  expect(isComparableProduct({ note: '', track_inventory: false })).toBe(false);
});

test('excludes labor (공임) products', () => {
  expect(isComparableProduct({ note: '공임', track_inventory: true })).toBe(false);
});

test('includes normal tracked products', () => {
  expect(isComparableProduct({ note: '', track_inventory: true })).toBe(true);
});

test('findMatchedVariant matches on exact trimmed code', () => {
  const variants = [{ custom_variant_code: '8809012345678 ', quantity: 5 }];
  expect(findMatchedVariant(variants, '8809012345678')).toBe(variants[0]);
});

test('findMatchedVariant falls back to digit-only match when formatting differs', () => {
  const variants = [{ custom_variant_code: '8809-0123-45678', quantity: 5 }];
  expect(findMatchedVariant(variants, '8809012345678')).toBe(variants[0]);
});

test('findMatchedVariant prefers exact match over a digit-only match', () => {
  const digitOnly = { custom_variant_code: '8809-0123-45678', quantity: 1 };
  const exact = { custom_variant_code: '8809012345678', quantity: 2 };
  expect(findMatchedVariant([digitOnly, exact], '8809012345678')).toBe(exact);
});

test('findMatchedVariant returns null when no barcode given', () => {
  const variants = [{ custom_variant_code: '8809012345678', quantity: 5 }];
  expect(findMatchedVariant(variants, '')).toBe(null);
});

test('findMatchedVariant returns null when nothing matches', () => {
  const variants = [{ custom_variant_code: '1234567890123', quantity: 5 }];
  expect(findMatchedVariant(variants, '8809012345678')).toBe(null);
});
