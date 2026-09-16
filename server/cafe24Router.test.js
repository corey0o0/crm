const test = require('node:test');
const assert = require('node:assert/strict');
const { mapCafe24Comments, buildCafe24Variants } = require('./cafe24Router');

test('maps Cafe24 comments to board post answers', () => {
  const answers = mapCafe24Comments([
    {
      comment_no: 12,
      content: '답변입니다.',
      writer: { name: '관리자', email: 'admin@example.com' },
      created_date: '2026-09-08T10:00:00+09:00',
    },
    {
      comment_no: 13,
      writer: null,
    },
  ]);

  assert.deepEqual(answers, [
    {
      comment_no: 12,
      content: '답변입니다.',
      writer_name: '관리자',
      writer_email: 'admin@example.com',
      created_date: '2026-09-08T10:00:00+09:00',
    },
    {
      comment_no: 13,
      content: '',
      writer_name: null,
      writer_email: null,
      created_date: null,
    },
  ]);
});

test('uses variant custom_variant_code for products with options', () => {
  const variants = buildCafe24Variants([
    {
      product_no: 1,
      product_name: '옵션상품',
      custom_product_code: 'P001',
      variants: [
        { variant_code: 'V1', custom_variant_code: 'OPT-A', quantity: 5, use_inventory: 'T', display: 'T' },
        { variant_code: 'V2', custom_variant_code: 'OPT-B', quantity: 3, use_inventory: 'T', display: 'T' },
      ],
    },
  ]);

  assert.deepEqual(variants, [
    { product_no: 1, product_name: '옵션상품', variant_code: 'V1', custom_variant_code: 'OPT-A', quantity: 5, use_inventory: true, display: true },
    { product_no: 1, product_name: '옵션상품', variant_code: 'V2', custom_variant_code: 'OPT-B', quantity: 3, use_inventory: true, display: true },
  ]);
});

test('falls back to product-level custom_product_code for no-option products', () => {
  const variants = buildCafe24Variants([
    {
      product_no: 2,
      product_name: '단품상품',
      custom_product_code: 'P002',
      variants: [
        { variant_code: 'V1', custom_variant_code: '', quantity: 10, use_inventory: 'T', display: 'T' },
      ],
    },
  ]);

  assert.deepEqual(variants, [
    { product_no: 2, product_name: '단품상품', variant_code: 'V1', custom_variant_code: 'P002', quantity: 10, use_inventory: true, display: true },
  ]);
});

test('excludes no-option product variant when neither custom_variant_code nor custom_product_code exist', () => {
  const variants = buildCafe24Variants([
    {
      product_no: 3,
      product_name: '코드없음',
      custom_product_code: '',
      variants: [
        { variant_code: 'V1', custom_variant_code: '', quantity: 1, use_inventory: 'T', display: 'T' },
      ],
    },
  ]);

  assert.deepEqual(variants, []);
});

test('does not fall back to product-level code for a multi-variant product missing its own code', () => {
  const variants = buildCafe24Variants([
    {
      product_no: 4,
      product_name: '부분옵션상품',
      custom_product_code: 'P004',
      variants: [
        { variant_code: 'V1', custom_variant_code: 'OPT-A', quantity: 5, use_inventory: 'T', display: 'T' },
        { variant_code: 'V2', custom_variant_code: '', quantity: 2, use_inventory: 'T', display: 'T' },
      ],
    },
  ]);

  assert.deepEqual(variants, [
    { product_no: 4, product_name: '부분옵션상품', variant_code: 'V1', custom_variant_code: 'OPT-A', quantity: 5, use_inventory: true, display: true },
  ]);
});
