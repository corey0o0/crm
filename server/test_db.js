const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { data, error } = await supabaseAdmin.from('cafe24_orders').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    // get column names
    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    console.log("Columns:", cols);
  }
}
test();
