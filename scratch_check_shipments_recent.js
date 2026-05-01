require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('shipments').select('id, note, sales_channel, created_at').order('created_at', { ascending: false }).limit(10);
  console.log(data);
}
check();
