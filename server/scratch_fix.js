require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  const orderId = 'd6647873-4bdb-49d6-aef1-a8efbf984c02';
  
  // Keep only the LAST transaction (which has B2B 자동전송)
  const txIdsToDelete = [14227, 14274, 14321];
  
  console.log('Deleting duplicate transactions:', txIdsToDelete);
  const { error: txErr } = await supabase
    .from('transactions')
    .delete()
    .in('id', txIdsToDelete);
    
  if (txErr) {
    console.error('Failed to delete transactions:', txErr);
  } else {
    console.log('Successfully deleted duplicate transactions.');
  }

  // Restore inventory for the deleted transactions.
  // We deleted 3 transactions of 2 items each, so we need to add 6 items back to W001 for product 1040.
  // Wait, let's just do an upsert or let's use the RPC or manual update.
  const warehouse_id = 'W001';
  const product_id = 1040;
  
  const { data: currentInv, error: invFetchErr } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('warehouse_id', warehouse_id)
    .eq('product_id', product_id)
    .single();

  if (invFetchErr) {
    console.error('Failed to fetch inventory:', invFetchErr);
  } else {
    const currentQuantity = currentInv.quantity;
    const newQuantity = currentQuantity + 6; // 3 duplicates * 2 items each
    
    console.log(`Restoring inventory for warehouse ${warehouse_id}, product ${product_id}: ${currentQuantity} -> ${newQuantity}`);
    
    const { error: invUpdateErr } = await supabase
      .from('inventory')
      .update({ quantity: newQuantity })
      .eq('warehouse_id', warehouse_id)
      .eq('product_id', product_id);
      
    if (invUpdateErr) {
      console.error('Failed to restore inventory:', invUpdateErr);
    } else {
      console.log('Successfully restored inventory.');
      
      // Also write an inventory_log to document the restoration
      const { error: logErr } = await supabase
        .from('inventory_logs')
        .insert({
          warehouse_id,
          part_id: null,
          part_name: '듀얼 배터리 스위치(셀렉터) - 48V [기종선택=48V(X200맥스/X100맥스/X200프로/X200S고급형/X200)]',
          part_code: '8809249919812',
          brand_code: 'XRB',
          change_type: 'correction',
          quantity_change: 6,
          previous_quantity: currentQuantity,
          new_quantity: newQuantity,
          reference_id: null,
          reference_type: 'system_correction',
          notes: '중복 전송(Race Condition) 오류 복구를 위한 재고 원복 (3건 x 2개)'
        });
        
      if (logErr) {
        console.error('Failed to create inventory log:', logErr);
      } else {
        console.log('Successfully created inventory log for the correction.');
      }
    }
  }
}

fix();
