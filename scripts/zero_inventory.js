require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching non-zero inventory...');
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('*')
    .neq('quantity', 0);

  if (error) {
    console.error('Error fetching inventory:', error);
    return;
  }

  console.log(`Found ${inventory.length} non-zero inventory records.`);
  if (inventory.length === 0) return;

  const transactions = inventory.map(inv => ({
    product_id: inv.product_id,
    type: 'outbound',
    quantity: inv.quantity,
    from_location: inv.warehouse_id,
    to_location: null, // external
    date: new Date().toISOString(),
    note: '기초 재고 세팅 전 0 초기화 (실사 조정)',
    status: 'completed'
  }));

  console.log(`Inserting ${transactions.length} adjustment transactions...`);
  const { error: txError } = await supabase
    .from('inventory_transactions')
    .insert(transactions);

  if (txError) {
    console.error('Error inserting transactions:', txError);
    return;
  }

  console.log('Transactions inserted. Updating inventory to 0...');
  
  // Update inventory table to 0
  const updates = inventory.map(inv => ({
    warehouse_id: inv.warehouse_id,
    product_id: inv.product_id,
    quantity: 0,
    updated_at: new Date().toISOString()
  }));

  const { error: updateError } = await supabase
    .from('inventory')
    .upsert(updates, { onConflict: 'warehouse_id,product_id' });

  if (updateError) {
    console.error('Error updating inventory:', updateError);
    return;
  }

  console.log('Done! All inventory is now 0 and logged.');
}

run();
