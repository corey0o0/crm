const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function check() {
  const { data, count, error } = await supabase
    .from('shipments')
    .select('id, record_type, sales_channel, note', { count: 'exact' })
    .eq('record_type', 'store_shipment')
    .or('note.ilike.*이카운트*,sales_channel.eq.과거 이카운트 이관,note.ilike.*[B2B수기판매]*,note.ilike.*[수기판매]*,note.ilike.*[엑셀일괄등록]*')
    .limit(5);

  console.log(`Found ${count || 0} misclassified items in store_shipment:`);
  console.log(data);
}
check();
