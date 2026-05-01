require('dotenv').config({ path: '.env' });
console.log('URL:', process.env.REACT_APP_SUPABASE_URL);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, group_id, note, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  if (data) console.log(data.slice(0, 2));
}
check();
