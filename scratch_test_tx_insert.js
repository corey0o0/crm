const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const ts = Date.now();
  console.log("Inserting with product_id:", ts);
  const { data, error } = await supabase.from('transactions').insert({
    group_id: 99999,
    type: 'out',
    product_id: ts,
    product_name: 'Test Part',
    quantity: 1,
    from_location: 'DEFAULT',
    date: '2026-05-01',
    note: 'Test',
    status: '완료'
  });
  if (error) console.error("Error:", error);
  else console.log("Success:", data);
}
check();
