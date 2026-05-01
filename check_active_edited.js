const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('cafe24_orders')
    .select('order_id, order_items')
    .eq('is_transferred', false)
    .eq('is_deleted', false);
    
  if (error) {
    console.error(error);
    return;
  }
  
  const edited = data.filter(order => order.order_items && order.order_items.some(i => i.is_edited_in_crm || i.is_manual_added));
  console.log(JSON.stringify(edited.map(o => o.order_id), null, 2));
}
check();
