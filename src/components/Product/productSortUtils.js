const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });

export const SORT_OPTIONS = [
  { value: 'default', label: '기본정렬' },
  { value: 'newest', label: '최신순' },
  { value: 'price_asc', label: '가격낮은순' },
  { value: 'price_desc', label: '가격높은순' },
  { value: 'stock_desc', label: '재고많은순' },
  { value: 'stock_asc', label: '재고적은순' }
];

export function sortProducts(products, sortOption) {
  const arr = [...products];
  switch (sortOption) {
    case 'newest':
      return arr.sort((a, b) => {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    case 'price_asc':
      return arr.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price_desc':
      return arr.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'stock_desc':
      return arr.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    case 'stock_asc':
      return arr.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    case 'default':
    default:
      return arr.sort((a, b) => collator.compare(a.name || '', b.name || ''));
  }
}
