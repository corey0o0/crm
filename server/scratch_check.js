require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const orderNo = '20260504-0000139';
  console.log('Checking order:', orderNo);

  const { data: order, error: orderErr } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, order_items')
    .eq('order_id', orderNo)
    .single();

  if (orderErr) {
    console.error('Order error:', orderErr);
    return;
  }
  
  console.log('Order UUID:', order.id);
  
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('group_id', order.id)
    .order('created_at', { ascending: true });
    
  if (txErr) {
    console.error('Tx error:', txErr);
    return;
  }
  
  console.log('Transactions found:', txs.length);
  console.log(txs.map(t => ({ id: t.id, created_at: t.created_at, note: t.note, product_id: t.product_id, quantity: t.quantity, from_location: t.from_location })));
  
  const { data: logs, error: logErr } = await supabase
    .from('inventory_logs')
    .select('*')
    .like('notes', `%${orderNo}%`)
    .order('created_at', { ascending: true });
    
  console.log('Inventory logs found:', logs ? logs.length : 0);
  if (logs) {
    console.log(logs.map(l => ({ id: l.id, created_at: l.created_at, notes: l.notes, quantity_change: l.quantity_change, warehouse_id: l.warehouse_id, part_id: l.part_id })));
  }
}

check();
