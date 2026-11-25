import { withMonthSnapshots } from './monthSnapshots';
import { supabase } from '../lib/supabaseClient';

jest.mock('../lib/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

// 체이닝 쿼리 흉내: 어떤 필터를 붙여도 마지막에 result로 resolve
const query = (result) => {
  const q = { select: () => q, eq: () => q, in: () => q, then: (ok, fail) => Promise.resolve(result).then(ok, fail) };
  return q;
};

const setup = ({ versions, snapshots, error }) => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  supabase.from.mockImplementation(table => {
    if (table === 'sales_month_versions') return query(error ? { data: null, error } : { data: versions, error: null });
    return { ...query({ data: snapshots, error: null }), upsert };
  });
  return upsert;
};

test('version 일치하는 스냅샷만 재사용, 나머지는 계산 후 계산 전 version으로 저장', async () => {
  const upsert = setup({
    versions: [{ month: '2026-01', version: 2 }, { month: '2026-02', version: 5 }, { month: 'ALL', version: 1 }],
    snapshots: [
      { month: '2026-01', data: { amount: 10 }, month_version: 2, global_version: 1 }, // 유효
      { month: '2026-02', data: { amount: 20 }, month_version: 4, global_version: 1 }, // 달 변경됨
      { month: '2026-03', data: { amount: 30 }, month_version: 0, global_version: 0 }, // 상품 변경(ALL)됨
    ],
  });
  const compute = jest.fn(async ms => Object.fromEntries(ms.map(m => [m, { amount: 99 }])));

  const out = await withMonthSnapshots('chart', 'v', ['2026-01', '2026-02', '2026-03'], compute);

  expect(compute).toHaveBeenCalledWith(['2026-02', '2026-03']);
  expect(out).toEqual({ '2026-01': { amount: 10 }, '2026-02': { amount: 99 }, '2026-03': { amount: 99 } });
  const saved = upsert.mock.calls[0][0].map(r => [r.month, r.month_version, r.global_version]);
  expect(saved).toEqual([['2026-02', 5, 1], ['2026-03', 0, 1]]);
});

test('테이블 조회 실패 시 전부 계산하고 저장 안 함', async () => {
  const upsert = setup({ error: { message: 'relation does not exist' } });
  const compute = jest.fn(async ms => Object.fromEntries(ms.map(m => [m, 1])));

  const out = await withMonthSnapshots('total', 'v', ['2026-01'], compute);

  expect(out).toEqual({ '2026-01': 1 });
  expect(upsert).not.toHaveBeenCalled();
});

test('계산 실패로 빠진 달은 저장 안 함', async () => {
  const upsert = setup({ versions: [], snapshots: [] });
  const out = await withMonthSnapshots('chart', 'v', ['2026-01', '2026-02'], async () => ({ '2026-01': { amount: 1 } }));

  expect(out).toEqual({ '2026-01': { amount: 1 } });
  expect(upsert.mock.calls[0][0].map(r => r.month)).toEqual(['2026-01']);
});
