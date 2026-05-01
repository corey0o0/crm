require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  console.log(Object.keys(data[0] || {}));
}
check();
