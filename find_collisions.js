require('dotenv').config({ path: 'server/.env' });
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function findCollisions() {
  console.log('Fetching Nearbike orders from Cafe24...');
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', 'nearbike').single();
  
  let nearbikeOrderIds = new Set();
  try {
    const endDate = new Date().toISOString().split('T')[0];
    let startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 2);
    const startStr = startDate.toISOString().split('T')[0];

    const res = await axios.get(`https://nearbike.cafe24api.com/api/v2/admin/orders`, {
      params: { start_date: startStr, end_date: endDate, limit: 1000 },
      headers: { 'Authorization': `Bearer ${mall.access_token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
    });
    
    if (res.data && res.data.orders) {
      res.data.orders.forEach(o => nearbikeOrderIds.add(o.order_id));
      console.log(`Fetched ${res.data.orders.length} orders from Nearbike Cafe24.`);
    }
  } catch (e) {
    console.error('Failed to fetch from Cafe24:', e.response ? e.response.data : e.message);
    return;
  }

  console.log('Checking against CRM database...');
  const { data: dbOrders, error } = await supabaseAdmin.from('cafe24_orders').select('id, order_id, mall_id, is_transferred');
  
  let collisions = [];
  let nearbikeMissing = [];

  for (const nbId of nearbikeOrderIds) {
    const hasPrefix = dbOrders.find(o => o.order_id === `nearbike_${nbId}`);
    const hasNoPrefix = dbOrders.find(o => o.order_id === nbId);

    if (hasNoPrefix) {
      collisions.push(hasNoPrefix);
    } else if (!hasPrefix) {
      nearbikeMissing.push(nbId);
    }
  }

  console.log('--- Collisions (Nearbike order ID exists WITHOUT prefix in DB) ---');
  console.log(collisions.map(c => `${c.order_id} (mall_id in DB: ${c.mall_id}, transferred: ${c.is_transferred})`));
  
  console.log(`\n--- Missing Nearbike Orders (${nearbikeMissing.length}) ---`);
  console.log(nearbikeMissing);
}

findCollisions();
