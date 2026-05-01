const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cData, error: cError } = await supabase.from('services').select('*').limit(1);
  if (cError) { console.error(cError); return; }

  console.log("Services Columns:", Object.keys(cData[0] || {}));
}
check();
