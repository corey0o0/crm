const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('shipments')
    .select('sales_channel, price, note')
    .ilike('note', '%[과거 이카운트 이관]%');
    
  let agency = 0, store = 0, online = 0;
  for(let r of data) {
      const isAgency = r.sales_channel && !['고객', '-', '일반출고(공홈)', '온라인주문', '매장출고', '청담매장', '기타', '본점'].includes(r.sales_channel);
      if (isAgency) agency += r.price;
      else if (r.sales_channel === '온라인주문') online += r.price;
      else store += r.price;
  }
  console.log({ agency, store, online });
}
check();
