const fs = require('fs');
let code = fs.readFileSync('src/utils/inventoryUtils.js', 'utf8');

const rollbackLogic = `
    const { data: service, error: srvErr } = await supabase.from('services').select('warehouse_id').eq('id', serviceId).single();
    if (srvErr || !service) throw new Error('A/S를 찾을 수 없음');
    
    // A/S에 창고 정보가 없다면 기본을 찾거나 오류 발생 (수동지정 필요)
    let warehouseId = service.warehouse_id;
    if (!warehouseId) {
      const { data: fw } = await supabase.from('warehouses').select('id').ilike('name', '%청담%').maybeSingle();
      warehouseId = fw ? fw.id : null;
      if(!warehouseId) throw new Error('A/S 처리에 할당된 창고가 없습니다.');
    }

    // --- ROLLBACK LOGIC ---
    // 기존 트랜잭션을 합산하여 이전에 차감된 잔여량이 있다면 우선 복구 진행
    const { data: allTxs } = await supabase
      .from('transactions')
      .select('type, product_id, product_name, product_code, quantity, from_location, to_location')
      .eq('group_id', String(serviceId));
      
    if (allTxs && allTxs.length > 0) {
      const netDeductions = {};
      allTxs.forEach(tx => {
        const whId = tx.type === 'out' ? tx.from_location : tx.to_location;
        const key = \`\${tx.product_id}_\${whId}\`;
        if (!netDeductions[key]) {
          netDeductions[key] = { 
            part_id: tx.product_id, 
            part_name: tx.product_name, 
            part_code: tx.product_code, 
            warehouse_id: whId, 
            net_qty: 0 
          };
        }
        netDeductions[key].net_qty += (tx.type === 'out' ? tx.quantity : -tx.quantity);
      });
      
      const revertParts = Object.values(netDeductions)
        .filter(tx => tx.net_qty > 0)
        .map(tx => ({
          part_id: tx.part_id,
          part_name: tx.part_name,
          part_code: tx.part_code,
          quantity: tx.net_qty,
          warehouse_id: tx.warehouse_id
        }));

      if (revertParts.length > 0) {
        console.log(\`[A/S Rollback] 기존 차감 잔액 복구 시작 (\${revertParts.length}품목)\`);
        const revertResult = await processInventory(warehouseId, revertParts, brandCode, serviceId, 'service', 'service_revert', true);
        if (!revertResult.success) {
           console.error('기존 재고 롤백 중 오류 발생:', revertResult);
        }
      }
    }
    // --- END ROLLBACK LOGIC ---
`;

code = code.replace(
  /const \{ data: service, error: srvErr \} = await supabase\.from\('services'\)\.select\('warehouse_id'\)\.eq\('id', serviceId\)\.single\(\);\n    if \(srvErr \|\| !service\) throw new Error\('A\/S를 찾을 수 없음'\);\n    \n    \/\/ A\/S에 창고 정보가 없다면 기본을 찾거나 오류 발생 \(수동지정 필요\)\n    let warehouseId = service\.warehouse_id;\n    if \(!warehouseId\) \{\n      \/\/ 청담 등 기본 창고 지정 로직을 서비스 내에 구축해야 하지만 여기서 일단 가장 먼저 등록된 창고 또는 오류 처리\n      const \{ data: fw \} = await supabase\.from\('warehouses'\)\.select\('id'\)\.ilike\('name', '%청담%'\)\.maybeSingle\(\);\n      warehouseId = fw \? fw\.id : null;\n      if\(!warehouseId\) throw new Error\('A\/S 처리에 할당된 창고가 없습니다\.'\);\n    \}/,
  rollbackLogic
);

fs.writeFileSync('src/utils/inventoryUtils.js', code);
