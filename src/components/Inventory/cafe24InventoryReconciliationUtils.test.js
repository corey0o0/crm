import { calculateSharedMallStock } from './cafe24InventoryReconciliationUtils';

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

test('marks shared stock missing when one shared mall is not linked', () => {
  const result = calculateSharedMallStock({
    slimpack79: { stock: 10, use_inventory: true },
    nearbike: { stock: null, use_inventory: false, status: '미연동' },
  }, 10);

  expect(result).toMatchObject({
    stock: 10,
    diff: 0,
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
