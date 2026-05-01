const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data } = await supabase.from('cafe24_orders').select('order_items').not('order_items', 'is', null).limit(10);
  console.log(JSON.stringify(data, null, 2));
})();
