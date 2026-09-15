import { supabase } from '../lib/supabaseClient';

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

afterEach(() => {
  delete process.env.REACT_APP_PARTS_BRAND;
});

function createParts(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    barcode: `barcode-${index + 1}`,
    name: `상품 ${index + 1}`,
    note: null,
  }));
}

function createPartsQuery(parts) {
  let currentRange = [0, 999];
  const query = {
    select: jest.fn(() => query),
    order: jest.fn(() => query),
    eq: jest.fn(() => query),
    range: jest.fn((from, to) => {
      currentRange = [from, to];
      return query;
    }),
    then: (resolve, reject) => {
      const [from, to] = currentRange;
      return Promise.resolve({ data: parts.slice(from, to + 1), error: null }).then(resolve, reject);
    },
  };
  return query;
}

test('loads parts beyond Supabase default page limit', async () => {
  const { productApi } = require('./productApi');
  const query = createPartsQuery(createParts(1001));
  supabase.from.mockReturnValue(query);

  const products = await productApi.getAll();

  expect(products).toHaveLength(1001);
  expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
  expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
});

test('keeps brand filter chainable while loading all parts', async () => {
  process.env.REACT_APP_PARTS_BRAND = 'NB';
  jest.resetModules();
  const { productApi: brandProductApi } = require('./productApi');
  const { supabase: brandSupabase } = require('../lib/supabaseClient');
  const query = createPartsQuery(createParts(1001));
  brandSupabase.from.mockReturnValue(query);

  const products = await brandProductApi.getAll();

  expect(products).toHaveLength(1001);
  expect(query.eq).toHaveBeenNthCalledWith(1, 'brand', 'NB');
  expect(query.eq).toHaveBeenNthCalledWith(2, 'brand', 'NB');
});
