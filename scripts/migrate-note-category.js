// '구분'(note 컬럼)의 '파츠'를 '파츠 - 일반 부품' / '파츠 - 전기 부품'으로 세분화
// 실제 운영 화면(PartsManagement.jsx)이 쓰는 컬럼은 note 다 (category 컬럼은 안 씀 - dead)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const ELECTRIC_KEYWORDS = [
  '모터', '컨트롤러', '릴레이', '메인케이블', '케이블', '젠더',
  '스위치', '디스플레이', '충전기', '라이트', '거치대', '트레이'
];

(async () => {
  // 1. 파츠 -> 파츠 - 일반 부품
  const { data: toGeneral, error: e1 } = await sb
    .from('parts')
    .update({ note: '파츠 - 일반 부품' })
    .eq('note', '파츠')
    .select('id');
  if (e1) { console.error(e1); process.exit(1); }
  console.log(`파츠 -> 파츠 - 일반 부품: ${toGeneral.length}건`);

  // 2. 전기 부품 키워드 매칭 -> 파츠 - 전기 부품
  // ponytail: update()+or() 조합이 PostgREST에서 'column name does not exist' 오류를 내서
  // select로 대상 id 먼저 뽑고 in()으로 업데이트 (동작 검증된 방식)
  const orFilter = ELECTRIC_KEYWORDS.map(k => `name.ilike.%${k}%`).join(',');
  const { data: candidates, error: eSel } = await sb
    .from('parts')
    .select('id')
    .eq('note', '파츠 - 일반 부품')
    .or(orFilter);
  if (eSel) { console.error(eSel); process.exit(1); }
  const ids = candidates.map(r => r.id);
  const { data: toElectric, error: e2 } = await sb
    .from('parts')
    .update({ note: '파츠 - 전기 부품' })
    .in('id', ids)
    .select('id');
  if (e2) { console.error(e2); process.exit(1); }
  console.log(`파츠 - 일반 부품 -> 파츠 - 전기 부품: ${toElectric.length}건`);

  const { data: final } = await sb.from('parts').select('note');
  const counts = {};
  final.forEach(r => { const k = r.note || '(empty)'; counts[k] = (counts[k]||0)+1; });
  console.log('최종 분포:', counts);
})();
