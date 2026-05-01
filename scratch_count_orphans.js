const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: orphans } = await supabase.from('transactions').select('id, group_id').is('group_id', null);
  console.log(`Orphaned transactions (group_id = null): ${orphans.length}`);
}
check();
