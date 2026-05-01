require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('shipments').select('id, note, sales_channel').ilike('note', '%cafe24%').limit(5);
  console.log(data);
}
check();
