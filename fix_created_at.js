const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCreatedAt() {
  // 1. shipments 가져오기 (created_at 이 오늘이면서, 과거이카운트이관 등인 것)
  const today = new Date().toISOString().split('T')[0];
  const { data: shipments, error } = await supabase.from('shipments')
    .select('id, order_date, created_at, note')
    .ilike('note', '%[과거 이카운트 이관]%')
    .gte('created_at', today + 'T00:00:00Z');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${shipments.length} shipments to update.`);
  
  let successCount = 0;
  for (const s of shipments) {
    if (s.order_date) {
      // order_date를 created_at으로 변환 (시간은 12:00:00으로 임의 지정)
      const newCreatedAt = `${s.order_date}T12:00:00.000Z`;
      const { error: updateErr } = await supabase.from('shipments')
        .update({ created_at: newCreatedAt })
        .eq('id', s.id);
        
      if (!updateErr) successCount++;
    }
  }
  
  console.log(`Successfully updated ${successCount} shipments.`);
}

fixCreatedAt();
