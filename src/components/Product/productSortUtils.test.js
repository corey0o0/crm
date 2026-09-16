import { sortProducts, SORT_OPTIONS } from './productSortUtils';

describe('sortProducts', () => {
  test('default: 숫자 → 가나다 → 영문 순 정렬', () => {
    const products = [
      { name: '가나다' }, { name: 'ABC' }, { name: '123' },
      { name: '나이키' }, { name: 'apple' }, { name: '7번' }, { name: '다이나모' }
    ];
    const result = sortProducts(products, 'default').map(p => p.name);
    expect(result).toEqual(['7번', '123', '가나다', '나이키', '다이나모', 'ABC', 'apple']);
  });

  test('newest: created_at 내림차순, null은 뒤로', () => {
    const products = [
      { name: 'A', created_at: '2026-01-01' },
      { name: 'B', created_at: null },
      { name: 'C', created_at: '2026-03-01' }
    ];
    const result = sortProducts(products, 'newest').map(p => p.name);
    expect(result).toEqual(['C', 'A', 'B']);
  });

  test('price_asc: 가격 오름차순', () => {
    const products = [{ name: 'A', price: 300 }, { name: 'B', price: 100 }, { name: 'C', price: 200 }];
    expect(sortProducts(products, 'price_asc').map(p => p.name)).toEqual(['B', 'C', 'A']);
  });

  test('price_desc: 가격 내림차순', () => {
    const products = [{ name: 'A', price: 300 }, { name: 'B', price: 100 }, { name: 'C', price: 200 }];
    expect(sortProducts(products, 'price_desc').map(p => p.name)).toEqual(['A', 'C', 'B']);
  });

  test('stock_desc: 재고 많은순', () => {
    const products = [{ name: 'A', stock: 5 }, { name: 'B', stock: 20 }, { name: 'C', stock: 10 }];
    expect(sortProducts(products, 'stock_desc').map(p => p.name)).toEqual(['B', 'C', 'A']);
  });

  test('stock_asc: 재고 적은순', () => {
    const products = [{ name: 'A', stock: 5 }, { name: 'B', stock: 20 }, { name: 'C', stock: 10 }];
    expect(sortProducts(products, 'stock_asc').map(p => p.name)).toEqual(['A', 'C', 'B']);
  });

  test('SORT_OPTIONS: 6개 프리셋, default가 첫번째', () => {
    expect(SORT_OPTIONS.map(o => o.value)).toEqual([
      'default', 'newest', 'price_asc', 'price_desc', 'stock_desc', 'stock_asc'
    ]);
  });
});
