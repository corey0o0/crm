const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: 'server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: mall } = await supabase.from('cafe24_settings').select('access_token').eq('mall_id', 'slimpack79').single();
  const token = mall.access_token;
  
  const res = await axios.get('https://slimpack79.cafe24api.com/api/v2/admin/orders/20260428-0000101?embed=items', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2023-09-01'
      }
    });
  console.log(JSON.stringify(res.data.order.items, null, 2));
}
run().catch(console.error);
