import { supabase } from '../lib/supabaseClient';

// 마감된 달 집계를 DB 스냅샷에서 꺼내고, 없거나 무효(원본 변경됨)인 달만 compute로 계산해 저장.
// 무효화는 DB 트리거가 sales_month_versions를 올리는 방식 (supabase/migrations/20261124_create_sales_month_snapshots.sql).
// 테이블이 없거나 조회 실패하면 전부 compute로 계산하고 저장 안 함 → 기존 동작과 동일.
export async function withMonthSnapshots(kind, variant, months, compute) {
  if (!months.length) return {};

  let versions = null;
  const cached = {};
  try {
    // version은 계산 전에 읽어야 계산 도중 변경분이 다음 조회 때 무효 처리됨
    const [vRes, sRes] = await Promise.all([
      supabase.from('sales_month_versions').select('month, version').in('month', [...months, 'ALL']),
      supabase.from('sales_month_snapshots').select('month, data, month_version, global_version')
        .eq('kind', kind).eq('variant', variant).in('month', months),
    ]);
    if (vRes.error) throw vRes.error;
    if (sRes.error) throw sRes.error;
    versions = {};
    (vRes.data || []).forEach(v => { versions[v.month] = Number(v.version); });
    const globalVersion = versions.ALL || 0;
    (sRes.data || []).forEach(s => {
      if (Number(s.month_version) === (versions[s.month] || 0) && Number(s.global_version) === globalVersion) {
        cached[s.month] = s.data;
      }
    });
  } catch (err) {
    console.warn('월 스냅샷 조회 실패 — 직접 계산:', err?.message || err);
    versions = null;
  }

  const missing = months.filter(m => !(m in cached));
  if (missing.length === 0) return cached;

  const computed = await compute(missing);

  if (versions) {
    const globalVersion = versions.ALL || 0;
    const rows = missing.filter(m => computed[m] !== undefined).map(m => ({
      kind, variant, month: m, data: computed[m],
      month_version: versions[m] || 0, global_version: globalVersion,
      computed_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await supabase.from('sales_month_snapshots').upsert(rows, { onConflict: 'kind,variant,month' });
      if (error) console.warn('월 스냅샷 저장 실패:', error.message);
    }
  }

  return { ...cached, ...computed };
}
