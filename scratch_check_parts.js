require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: parts } = await supabase.from('parts').select('id, name, note').ilike('name', '%X100%');
  console.log(parts.slice(0, 5));
}
check();
