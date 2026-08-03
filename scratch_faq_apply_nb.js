const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
// --seed=./파일.json 로 다른 시드 지정 가능 (기본: 기존 NB 시드)
const seedPath = (process.argv.find((a) => a.startsWith('--seed=')) || '--seed=./scratch_faq_seed_nb.json').slice(7);
const seed = require(seedPath);

const APPLY = process.argv.includes('--apply'); // 기본 dry-run

const uniq = (a) => [...new Set(a.map(s => String(s).trim()).filter(Boolean))];

(async () => {
  const { data: existing } = await sb.from('faq_items')
    .select('id,brand,label,keywords,answer,sort_order')
    .in('brand', ['NB', 'SHARED']);
  const byLabel = {};
  (existing || []).forEach(r => { byLabel[r.brand + '::' + r.label] = r; });
  const maxSort = Math.max(0, ...(existing || []).map(r => Number(r.sort_order) || 0));

  const toInsert = [], toUpdate = [];

  // 신규 FAQ
  seed.faqs.forEach((f, i) => {
    const hitNB = byLabel['NB::' + f.label];
    const hitSH = byLabel['SHARED::' + f.label];
    const hit = hitNB || hitSH;
    if (hit) {
      const merged = uniq([...(Array.isArray(hit.keywords) ? hit.keywords : []), ...f.keywords]);
      toUpdate.push({ id: hit.id, label: f.label, brand: hit.brand, keywords: merged, answer: f.answer, _kwAdded: merged.length - (hit.keywords || []).length });
    } else {
      toInsert.push({ brand: 'NB', label: f.label, keywords: f.keywords, answer: f.answer, category: f.category || null, is_active: true, source: '상담정리', sort_order: maxSort + 100 + i });
    }
  });

  // 기존 보강(키워드만 병합)
  Object.entries(seed.enhance_existing || {}).forEach(([label, kws]) => {
    const hit = byLabel['NB::' + label] || byLabel['SHARED::' + label];
    if (!hit) { console.log('⚠ 보강대상 없음:', label); return; }
    const merged = uniq([...(Array.isArray(hit.keywords) ? hit.keywords : []), ...kws]);
    if (merged.length !== (hit.keywords || []).length)
      toUpdate.push({ id: hit.id, label, brand: hit.brand, keywords: merged, _kwAdded: merged.length - (hit.keywords || []).length });
  });

  console.log(`=== ${APPLY ? '적용' : 'DRY-RUN'} ===`);
  console.log(`INSERT(신규) ${toInsert.length}건:`, toInsert.map(r => r.label).join(', '));
  console.log(`UPDATE ${toUpdate.length}건:`, toUpdate.map(r => `${r.label}(${r.brand}${r.answer ? ',답변갱신' : ''},+kw${r._kwAdded})`).join(', '));

  if (!APPLY) { console.log('\n실제 반영하려면 --apply'); return; }

  for (let i = 0; i < toInsert.length; i += 50) {
    const { error } = await sb.from('faq_items').insert(toInsert.slice(i, i + 50));
    if (error) console.log('INSERT 오류:', error.message);
  }
  for (const u of toUpdate) {
    const patch = { keywords: u.keywords };
    if (u.answer) patch.answer = u.answer;
    const { error } = await sb.from('faq_items').update(patch).eq('id', u.id);
    if (error) console.log('UPDATE 오류', u.label, error.message);
  }
  console.log('\n✓ 반영 완료. NB+SHARED faq_items 재집계:');
  const { count } = await sb.from('faq_items').select('*', { count: 'exact', head: true }).in('brand', ['NB', 'SHARED']).eq('is_active', true);
  console.log('활성 FAQ:', count, '건');
})();
