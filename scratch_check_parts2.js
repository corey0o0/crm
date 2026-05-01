require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data: parts } = await supabase.from('parts').select('id, name, note, barcode').eq('barcode', '8809249917795');
  console.log(parts);
}
check();
