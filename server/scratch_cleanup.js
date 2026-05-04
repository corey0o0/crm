require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function isValidUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function cleanup() {
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .not('group_id', 'is', null);

  if (txErr) throw txErr;

  const groups = {};
  for (const tx of txs) {
    if (tx.type !== 'out') continue;
    if (!isValidUUID(tx.group_id)) continue;
    
    // Using from_location as well in case same product is shipped from different warehouses
    const key = `${tx.group_id}_${tx.product_id}_${tx.quantity}_${tx.from_location}`;
    if (!groups[key]) {
      groups[key] = {
        txs: []
      };
    }
    groups[key].txs.push(tx);
  }

  const duplicatesToProcess = Object.values(groups).filter(g => g.txs.length > 1);
  
  if (duplicatesToProcess.length === 0) {
    console.log('No duplicates to clean up.');
    return;
  }

  const txIdsToDelete = [];
  const inventoryRestorations = {}; // { warehouse_id_product_id: sum_quantity }

  for (const g of duplicatesToProcess) {
    // Sort transactions by id descending (keep the newest one)
    g.txs.sort((a, b) => b.id - a.id);
    
    // The first element is the newest (to keep). The rest are duplicates to delete.
    const toKeep = g.txs[0];
    const toDelete = g.txs.slice(1);
    
    for (const tx of toDelete) {
      txIdsToDelete.push(tx.id);
      
      const invKey = `${tx.from_location}_${tx.product_id}`;
      if (!inventoryRestorations[invKey]) {
        inventoryRestorations[invKey] = 0;
      }
      inventoryRestorations[invKey] += tx.quantity;
    }
  }

  console.log(`Found ${txIdsToDelete.length} duplicate transactions to delete.`);
  console.log('Inventory to restore:', inventoryRestorations);

  // 1. Delete the transactions
  console.log('Deleting duplicate transactions...');
  // We can delete in batches of 100
  for (let i = 0; i < txIdsToDelete.length; i += 100) {
    const batch = txIdsToDelete.slice(i, i + 100);
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .in('id', batch);
    if (delErr) {
      console.error('Failed to delete batch:', delErr);
      return;
    }
  }
  console.log('Successfully deleted transactions.');

  // 2. Restore the inventory
  console.log('Restoring inventory...');
  for (const [key, qty] of Object.entries(inventoryRestorations)) {
    const [warehouse_id, product_id_str] = key.split('_');
    const product_id = parseInt(product_id_str);
    
    // Get current quantity
    const { data: inv, error: invFetchErr } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('warehouse_id', warehouse_id)
      .eq('product_id', product_id)
      .single();
      
    if (invFetchErr && invFetchErr.code !== 'PGRST116') {
      console.error(`Failed to fetch inventory for ${key}:`, invFetchErr);
      continue;
    }
    
    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty + qty;
    
    const { error: invUpErr } = await supabase
      .from('inventory')
      .upsert({ warehouse_id, product_id, quantity: newQty, updated_at: new Date().toISOString() }, { onConflict: 'warehouse_id,product_id' });
      
    if (invUpErr) {
      console.error(`Failed to restore inventory for ${key}:`, invUpErr);
    } else {
      console.log(`Restored ${qty} items for ${key} (New qty: ${newQty})`);
    }
  }
  console.log('Cleanup completed successfully.');
}

cleanup();
