require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function run() {
  console.log('Fetching non-zero parts stock...');
  const { data: parts, error } = await supabase
    .from('parts')
    .select('id, name, stock')
    .neq('stock', 0)
    .not('stock', 'is', null);

  if (error) {
    console.error('Error fetching parts:', error);
    return;
  }

  console.log(`Found ${parts.length} parts with non-zero stock.`);
  if (parts.length === 0) return;

  const transactions = parts.map(p => ({
    product_id: p.id,
    type: 'outbound',
    quantity: p.stock,
    from_location: 'adjustment', // '실사입력'
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
    // maybe table is named 'transactions'
    console.log('Retrying with "transactions" table...');
    const { error: txError2 } = await supabase
      .from('transactions')
      .insert(transactions);
    if (txError2) {
      console.error('Error inserting transactions:', txError2);
      return;
    }
  }

  console.log('Transactions inserted. Updating parts stock to 0...');
  
  // Update parts table to 0
  const updates = parts.map(p => ({
    id: p.id,
    stock: 0
  }));

  const { error: updateError } = await supabase
    .from('parts')
    .upsert(updates, { onConflict: 'id' });

  if (updateError) {
    console.error('Error updating parts:', updateError);
    return;
  }

  console.log('Done! All legacy parts stock is now 0 and logged.');
}

run();
