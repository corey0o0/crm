const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function check() {
  console.log("1. Checking Store Shipments (record_type = 'store_shipment') that might be manual sales:");
  const { data: mixedStore, error: err1 } = await supabase
    .from('shipments')
    .select('id, record_type, sales_channel, note, delivery_method')
    .eq('record_type', 'store_shipment')
    .or('note.ilike.%[수기판매]%,note.ilike.%[B2B수기판매]%,sales_channel.eq.[B2B수기],delivery_method.eq.수기판매,sales_channel.eq.과거 이카운트 이관,note.ilike.%[엑셀일괄등록]%')
    .limit(10);
  
  if (err1) console.error(err1);
  console.log(`Found ${mixedStore?.length || 0} misclassified store shipments:`);
  console.log(mixedStore);

  console.log("\n2. Checking Manual Sales (record_type = 'manual_sale') that might be store shipments:");
  // It's harder to identify normal ones in manual_sale, but let's check empty notes
  const { data: mixedManual, error: err2 } = await supabase
    .from('shipments')
    .select('id, record_type, sales_channel, note, delivery_method')
    .eq('record_type', 'manual_sale')
    .not('note', 'ilike', '%[수기판매]%')
    .not('note', 'ilike', '%[B2B수기판매]%')
    .not('sales_channel', 'eq', '[B2B수기]')
    .not('delivery_method', 'eq', '수기판매')
    .not('sales_channel', 'eq', '과거 이카운트 이관')
    .limit(10);

  if (err2) console.error(err2);
  console.log(`Found ${mixedManual?.length || 0} manual sales without obvious tags:`);
  console.log(mixedManual);
}

check();
