const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function processInventory(warehouseId, parts, brandCode, referenceId, referenceType, changeType, isRevert = false, customerName = '') {
  // simplified for the fix script
  for (const part of parts) {
    if (!part.part_id) continue;
    const quantityChange = isRevert ? part.quantity : -part.quantity;
    await supabase.rpc('adjust_inventory', {
      p_warehouse_id: warehouseId,
      p_product_id: part.part_id,
      p_quantity_change: quantityChange
    });
    
    // log
    await supabase.from('inventory_logs').insert({
      part_id: null,
      part_name: part.part_name,
      part_code: part.part_code,
      change_type: changeType,
      quantity_change: quantityChange,
      reference_id: referenceId,
      reference_type: referenceType,
      notes: isRevert ? 'Data correction: Revert ghost deduction' : 'Data correction: Apply missing deduction'
    });
    
    // transaction
    await supabase.from('transactions').insert({
      group_id: referenceId,
      type: isRevert ? 'in' : 'out',
      product_id: part.part_id,
      product_name: part.part_name,
      product_code: part.part_code,
      quantity: Math.abs(quantityChange),
      from_location: isRevert ? '외부(취소/환불)' : warehouseId,
      to_location: isRevert ? warehouseId : '외부(고객)',
      date: new Date().toISOString().split('T')[0],
      note: isRevert ? `[매장출고 취소] 롤백 (Ref: ${referenceId})` : `[매장출고 완료] (Ref: ${referenceId})`,
      is_grouped: true,
      status: '완료'
    });
  }
}

async function run() {
  console.log("Starting Data Corrections...");

  // 1. Missing to_location
  const { data: missingToLoc } = await supabase.from('transactions').select('id').is('to_location', null);
  if (missingToLoc && missingToLoc.length > 0) {
    console.log(`Fixing ${missingToLoc.length} missing to_location...`);
    for (let i = 0; i < missingToLoc.length; i+=50) {
      await Promise.all(missingToLoc.slice(i, i+50).map(t => 
        supabase.from('transactions').update({ to_location: '외부(고객)' }).eq('id', t.id)
      ));
    }
  }

  // 2. Orphaned transactions
  const { data: allTxs } = await supabase.from('transactions').select('id, group_id, product_id, product_name, product_code, quantity, from_location, to_location, type');
  const { data: allShipments } = await supabase.from('shipments').select('id');
  const { data: shipLogs } = await supabase.from('inventory_logs').select('reference_id');
  
  const shipmentIds = new Set(allShipments ? allShipments.map(s => String(s.id)) : []);
  const loggedRefIds = new Set(shipLogs ? shipLogs.map(l => String(l.reference_id)) : []);
  
  const orphans = [];
  if (allTxs) {
    for (const tx of allTxs) {
      if (tx.group_id && String(tx.group_id).length < 15 && !String(tx.group_id).startsWith('AS-')) {
        if (!shipmentIds.has(String(tx.group_id))) {
          if (loggedRefIds.has(String(tx.group_id))) {
             orphans.push(tx);
          }
        }
      }
    }
  }
  
  console.log(`Fixing ${orphans.length} orphaned records...`);
  const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').limit(1).single();
  const defaultWh = fw ? fw.id : 'W001';
  
  for (const tx of orphans) {
    if (tx.product_id && tx.type === 'out') {
      await supabase.rpc('adjust_inventory', {
        p_warehouse_id: defaultWh,
        p_product_id: tx.product_id,
        p_quantity_change: tx.quantity
      });
      await supabase.from('inventory_logs').insert({
        part_id: null, part_name: tx.product_name, part_code: tx.product_code,
        change_type: 'shipment_revert', quantity_change: tx.quantity, reference_id: tx.group_id, reference_type: 'shipment',
        notes: 'Data correction: Reverted ghost orphan deduction'
      });
    }
    await supabase.from('transactions').delete().eq('id', tx.id);
  }

  // 3. Missing inventory deductions
  const { data: completedShipments } = await supabase.from('shipments').select('id, brand, customer_name').eq('status', '출고완료');
  const missingLogs = [];
  if (completedShipments) {
    for (const s of completedShipments) {
      if (!loggedRefIds.has(String(s.id))) {
        missingLogs.push(s);
      }
    }
  }
  
  console.log(`Fixing ${missingLogs.length} missing deductions...`);
  for (const s of missingLogs) {
    await supabase.from('transactions').delete().eq('group_id', s.id);
    const { data: parts } = await supabase.from('shipment_parts').select('part_code, part_name, quantity').eq('shipment_id', s.id);
    if (!parts || parts.length === 0) continue;
    
    const formattedParts = [];
    for (const p of parts) {
      let pId = null;
      if (p.part_code) {
        const { data: dbP } = await supabase.from('parts').select('id').eq('code', p.part_code).limit(1).maybeSingle();
        if (dbP) pId = dbP.id;
      }
      if (!pId && p.part_name) {
        const { data: dbP } = await supabase.from('parts').select('id').eq('name', p.part_name).limit(1).maybeSingle();
        if (dbP) pId = dbP.id;
      }
      formattedParts.push({ part_id: pId, part_name: p.part_name, part_code: p.part_code, quantity: p.quantity });
    }
    await processInventory(defaultWh, formattedParts, s.brand, s.id, 'shipment', 'shipment_complete', false, s.customer_name);
  }

  console.log("Data Corrections Finished!");
}
run();
