const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder() {
  const { data, error, count } = await supabase
    .from('cafe24_orders')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(error);
  } else {
    console.log("Total orders:", count);
  }
}
checkOrder();
