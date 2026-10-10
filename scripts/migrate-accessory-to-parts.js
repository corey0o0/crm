// '악세서리' → '파츠 - 악세서리' 일괄 변경
// parts 테이블 note 컬럼 업데이트
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_KEY 환경변수 필요');
  process.exit(1);
}

const sb = createClient(process.env.REACT_APP_SUPABASE_URL, SERVICE_KEY);

(async () => {
  const { data: before } = await sb.from('parts').select('id').eq('note', '악세서리');
  console.log(`업데이트 전: ${before.length}건`);

  const { data: updated, error } = await sb
    .from('parts')
    .update({ note: '파츠 - 악세서리' })
    .eq('note', '악세서리')
    .select('id, name');

  if (error) { console.error(error); process.exit(1); }
  console.log(`업데이트 완료: ${updated.length}건`);
  updated.forEach(p => console.log('  -', p.name));

  const { data: after } = await sb.from('parts').select('id').eq('note', '악세서리');
  console.log(`남은 악세서리: ${after.length}건`);
})();
