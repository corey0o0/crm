const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('shipments')
    .select('id, sales_channel, note')
    .ilike('note', '%[과거 이카운트 이관]%')
    .or('sales_channel.is.null,sales_channel.eq.')
    .limit(10);
  console.log(data);
}
check();
