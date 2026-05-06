require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data } = await supabaseAdmin.from('transactions').select('id, type, product_name, quantity, note, created_at').eq('group_id', 'f8137270-169e-4496-8b30-542cf955fc98').order('created_at', { ascending: true });
  data.forEach((row, idx) => console.log(`[${idx+1}] ID: ${row.id} | Type: ${row.type.padEnd(3)} | Time: ${row.created_at.slice(11, 23)} | Item: ${row.product_name}`));
}
check();
