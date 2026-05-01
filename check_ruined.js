const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const ids = [
    '20260423-0000019', '20260306-0000172', '20260306-0000146', 
    '20260306-0000122', '20260404-0000138', '20260312-0000077', 
    '20260411-0000146', '20260311-0000191', '20260427-0000202', 
    '20260403-0000012', '20260402-0000179', '20260417-0000038', 
    '20260316-0000206'
  ];
  const { data, error } = await supabase.from('cafe24_orders').select('order_id, order_items').in('order_id', ids);
  
  const ruined = data.filter(order => order.order_items.some(i => i.is_edited_in_crm || i.is_manual_added));
  console.log(JSON.stringify(ruined, null, 2));
}
check();
