const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCreatedAt() {
  const { data: shipments, error } = await supabase.from('shipments')
    .select('id, order_date, created_at, note')
    .or('note.ilike.%[엑셀일괄등록]%,note.ilike.%[수기판매]%');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${shipments.length} shipments to check.`);
  
  let successCount = 0;
  for (const s of shipments) {
    if (s.order_date) {
      const orderDateStr = s.order_date.split('T')[0];
      const createdDateStr = s.created_at.split('T')[0];
      
      // 만약 생성일과 주문일이 다르고, 생성일이 오늘(또는 최근 며칠내) 이라면
      if (orderDateStr !== createdDateStr && new Date(s.created_at) > new Date('2026-04-28')) {
          const newCreatedAt = `${orderDateStr}T12:00:00.000Z`;
          const { error: updateErr } = await supabase.from('shipments')
            .update({ created_at: newCreatedAt })
            .eq('id', s.id);
            
          if (!updateErr) successCount++;
      }
    }
  }
  
  console.log(`Successfully updated ${successCount} additional shipments.`);
}

fixCreatedAt();
