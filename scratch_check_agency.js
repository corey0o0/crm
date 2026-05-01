require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: agencies } = await supabase.from('agencies').select('id, name').limit(1);
  console.log('Agencies:', JSON.stringify(agencies, null, 2));
}
check();
