const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data: agencies } = await supabase.from('agencies').select('name');
  const agencyNames = agencies.map(a => a.name);
  
  const { data: shipments } = await supabase.from('shipments')
    .select('id, sales_channel, customer_name, note')
    .in('sales_channel', ['기타', '고객', '-', '본점', '매장출고']);

  let count = 0;
  for(let s of shipments) {
    const isDealer = agencyNames.some(a => a === s.customer_name || s.customer_name.includes(a) || a.includes(s.customer_name));
    
    // 만약 대리점인데 sales_channel이 기타, 고객 등으로 되어있다면 수정!
    if (isDealer) {
      console.log(`Fixing: ${s.customer_name} (was ${s.sales_channel}) -> to ${s.customer_name}`);
      await supabase.from('shipments').update({ sales_channel: s.customer_name }).eq('id', s.id);
      count++;
    }
  }
  console.log(`Updated ${count} shipments.`);
}

fix();
