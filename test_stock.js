const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const { data: parts } = await supabaseAdmin.from('parts').select('id, name, stock').not('stock', 'is', null).limit(3);
  const { data: invs } = await supabaseAdmin.from('inventory').select('product_id, quantity').in('product_id', parts.map(p => p.id));
  
  parts.forEach(p => {
    const invQty = invs.filter(i => i.product_id === p.id).reduce((sum, i) => sum + i.quantity, 0);
    console.log(`Part: ${p.name}, parts.stock: ${p.stock}, inventory sum: ${invQty}`);
  });
}
test();
