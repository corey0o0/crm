require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: parts } = await supabaseAdmin.from('parts').select('name, code, barcode, note, brand');
  pieces = parts.filter(p => p.name.includes('수납가방') || p.name.includes('킥스탠드') || p.name.includes('유성기어'));
  console.log(pieces);
}

run();
