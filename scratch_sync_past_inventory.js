const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSync() {
  console.log("Fetching existing transactions...");
  const { data: txs } = await supabase.from('transactions').select('group_id, type, quantity');
  const txByGroupId = {};
  txs.forEach(tx => {
    if (!tx.group_id) return;
    const gId = String(tx.group_id);
    if (!txByGroupId[gId]) txByGroupId[gId] = [];
    txByGroupId[gId].push(tx);
  });

  console.log("Fetching parts dictionary...");
  const { data: allParts } = await supabase.from('parts').select('id, name, code');
  
  // Create a map for quick lookup
  const partCodeMap = {};
  const partNameMap = {};
  allParts.forEach(p => {
    if (p.code) partCodeMap[p.code] = p;
    if (p.name) partNameMap[p.name] = p;
  });

  // Default warehouse (청담본점)
  const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').limit(1).maybeSingle();
  const defaultWhId = fw ? fw.id : 'W001';

  // --- 1. SHIPMENTS ---
  console.log("Fetching completed shipments...");
  const { data: shipments } = await supabase.from('shipments').select('id, status, order_date, brand').eq('status', '출고완료');
  const { data: shipParts } = await supabase.from('shipment_parts').select('shipment_id, quantity, part_name, part_code');

  const shipPartsByShipmentId = {};
  shipParts.forEach(sp => {
    if (!shipPartsByShipmentId[sp.shipment_id]) shipPartsByShipmentId[sp.shipment_id] = [];
    shipPartsByShipmentId[sp.shipment_id].push(sp);
  });

  let shipFixed = 0;
  for (const ship of shipments) {
    const sId = String(ship.id);
    const requiredParts = shipPartsByShipmentId[ship.id] || [];
    const txRecords = txByGroupId[sId] || [];
    
    let netTxOut = 0;
    txRecords.forEach(tx => {
      if (tx.type === 'out') netTxOut += tx.quantity;
      if (tx.type === 'in') netTxOut -= tx.quantity;
    });

    const totalRequired = requiredParts.reduce((sum, p) => sum + p.quantity, 0);

    if (totalRequired > netTxOut) {
      // We need to insert missing transactions!
      // To be safe and simple, if netTxOut is 0 (which is the case for 99%), we just insert all required parts.
      // If it's partial, we might skip to avoid complex partial logic, but let's just insert the difference.
      // For simplicity, if netTxOut < totalRequired, we just insert all of them IF netTxOut == 0.
      if (netTxOut === 0) {
        for (const sp of requiredParts) {
          if (sp.quantity <= 0) continue;
          
          let partId = null;
          let realName = sp.part_name;
          let realCode = sp.part_code;

          if (sp.part_code && partCodeMap[sp.part_code]) {
            partId = partCodeMap[sp.part_code].id;
            realName = partCodeMap[sp.part_code].name;
          } else if (sp.part_name && partNameMap[sp.part_name]) {
            partId = partNameMap[sp.part_name].id;
            realCode = partNameMap[sp.part_name].code;
          }

          const inferredBrand = ship.brand || (
            (realCode && (realCode.toUpperCase().startsWith('NB') || realCode.toUpperCase().includes('NEARBIKE'))) ||
            (realName && (realName.toUpperCase().startsWith('NB') || realName.includes('니어'))) 
            ? 'NB' : 'XRB'
          );

          // 1. Update Inventory via RPC
          if (partId) {
            await supabase.rpc('adjust_inventory', {
              p_warehouse_id: defaultWhId,
              p_product_id: partId,
              p_quantity_change: -sp.quantity
            });
          }

          // 2. Insert Transaction
          const txDate = ship.order_date ? ship.order_date.split('T')[0] : new Date().toISOString().split('T')[0];
          await supabase.from('transactions').insert({
            group_id: sId,
            type: 'out',
            product_id: partId,
            product_name: realName,
            product_code: realCode,
            product_supplier: inferredBrand,
            quantity: sp.quantity,
            from_location: defaultWhId,
            to_location: '외부(고객)',
            date: txDate, // Use order_date!
            note: `[매장출고 완료] 재고 차감 (Ref: ${sId})`,
            is_grouped: true,
            status: '완료'
          });
        }
        shipFixed++;
      }
    }
  }
  console.log(`Shipments fixed: ${shipFixed}`);

  // --- 2. SERVICES ---
  console.log("Fetching completed services...");
  const { data: services } = await supabase.from('services').select('id, status, created_at, completion_date, brand').in('status', ['완료', '처리중']);
  const { data: srvParts } = await supabase.from('service_parts').select('service_id, quantity, usage, part_id, parts(name, code)');

  const srvPartsByServiceId = {};
  srvParts.forEach(sp => {
    if (!srvPartsByServiceId[sp.service_id]) srvPartsByServiceId[sp.service_id] = [];
    srvPartsByServiceId[sp.service_id].push(sp);
  });

  let srvFixed = 0;
  for (const srv of services) {
    const sId = String(srv.id);
    const requiredParts = srvPartsByServiceId[srv.id] || [];
    const txRecords = txByGroupId[sId] || [];
    
    // For services, required is quantity - returned
    let totalRequired = 0;
    requiredParts.forEach(sp => {
        let returnedQty = 0;
        if (sp.usage && sp.usage.includes('[반품완료]')) {
          returnedQty = sp.quantity;
        } else if (sp.usage) {
          const matches = sp.usage.match(/\[부분반품:(\d+)개\]/g);
          if (matches) {
            matches.forEach(m => {
              const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
              if (qtyMatch && qtyMatch[1]) returnedQty += parseInt(qtyMatch[1], 10);
            });
          }
        }
        const effectiveQty = Math.max(0, sp.quantity - returnedQty);
        totalRequired += effectiveQty;
        sp.effectiveQty = effectiveQty; // save for later
    });

    let netTxOut = 0;
    txRecords.forEach(tx => {
      if (tx.type === 'out') netTxOut += tx.quantity;
      if (tx.type === 'in') netTxOut -= tx.quantity;
    });

    if (totalRequired > netTxOut && netTxOut === 0) {
      for (const sp of requiredParts) {
        if (sp.effectiveQty <= 0) continue;
        
        const partId = sp.part_id;
        const realName = sp.parts?.name || 'Unknown';
        const realCode = sp.parts?.code || 'Unknown';

        const inferredBrand = srv.brand || (
          (realCode && (realCode.toUpperCase().startsWith('NB') || realCode.toUpperCase().includes('NEARBIKE'))) ||
          (realName && (realName.toUpperCase().startsWith('NB') || realName.includes('니어'))) 
          ? 'NB' : 'XRB'
        );

        if (partId) {
          await supabase.rpc('adjust_inventory', {
            p_warehouse_id: defaultWhId,
            p_product_id: partId,
            p_quantity_change: -sp.effectiveQty
          });
        }

        let srvDate = srv.created_at ? srv.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
        if (srv.completion_date) {
            // "2026-05-01" or similar
            srvDate = srv.completion_date.split('T')[0].split(' ')[0];
        }

        await supabase.from('transactions').insert({
          group_id: sId,
          type: 'out',
          product_id: partId,
          product_name: realName,
          product_code: realCode,
          product_supplier: inferredBrand,
          quantity: sp.effectiveQty,
          from_location: defaultWhId,
          to_location: '외부(고객)',
          date: srvDate,
          note: `[A/S 완료] 재고 차감 (Ref: ${sId})`,
          is_grouped: true,
          status: '완료'
        });
      }
      srvFixed++;
    }
  }
  console.log(`Services fixed: ${srvFixed}`);
  console.log("Sync Complete!");
}

runSync();
