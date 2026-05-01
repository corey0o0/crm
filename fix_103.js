const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrder() {
  const { error } = await supabase
    .from('cafe24_orders')
    .update({ total_amount: 956000, used_points: 0 })
    .eq('order_id', '20260410-0000103');
  
  if (error) {
    console.error('Error updating DB:', error);
  } else {
    console.log('Order 20260410-0000103 fixed (total_amount=956000, used_points=0).');
  }
}
fixOrder();
