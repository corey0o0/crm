const fs = require('fs');
const path = './src/pages/inventory/InventoryLayout.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. In handleSubmitTransaction, replace:
// newTransactions.forEach(t => updateInventory(t));
// with:
// for (const t of newTransactions) { await updateInventory(t); }

content = content.replace(
  'newTransactions.forEach(t => updateInventory(t));',
  'for (const t of newTransactions) { await updateInventory(t); }'
);

// 2. In handleExcelDataSubmit, replace:
// inventoryUpdates.forEach(transaction => { updateInventory(transaction); });
// with:
// for (const transaction of inventoryUpdates) { await updateInventory(transaction); }

content = content.replace(
  /inventoryUpdates\.forEach\(transaction => \{\s*updateInventory\(transaction\);\s*\}\);/,
  'for (const transaction of inventoryUpdates) { await updateInventory(transaction); }'
);

// 3. Rewrite updateInventory completely
// Extract the current updateInventory implementation
const oldUpdateInventoryStr = `  const updateInventory = async (transaction) => {
    setInventory(prev => {
      const newInventory = { ...prev };
      
      if (transaction.type === 'in') {
        // 입고 처리 - 목적지가 창고인 경우만 재고 증가
        if (warehouses.find(w => w.id === transaction.toLocation)) {
          if (!newInventory[transaction.toLocation]) {
            newInventory[transaction.toLocation] = {};
          }
          if (!newInventory[transaction.toLocation][transaction.productId]) {
            newInventory[transaction.toLocation][transaction.productId] = 0;
          }
          newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          
          // 서버에 재고 업데이트
          inventoryApi.upsert(transaction.toLocation, transaction.productId, newInventory[transaction.toLocation][transaction.productId]);
          
          // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
          const warehouse = warehouses.find(w => w.id === transaction.toLocation);
          if (warehouse?.syncWithProductStock) {
            updateProductStock(transaction.productId, transaction.quantity, 'increase');
          }
        }
        
        // 출발지가 창고/대리점인 경우 (창고→창고, 대리점→창고 이동) 출발지에서 재고 차감
        if (warehouses.find(w => w.id === transaction.fromLocation)) {
          if (newInventory[transaction.fromLocation] && 
              newInventory[transaction.fromLocation][transaction.productId]) {
            newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            
            // 서버에 재고 업데이트
            inventoryApi.upsert(transaction.fromLocation, transaction.productId, newInventory[transaction.fromLocation][transaction.productId]);
            
            // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
            const warehouse = warehouses.find(w => w.id === transaction.fromLocation);
            if (warehouse?.syncWithProductStock) {
              updateProductStock(transaction.productId, -transaction.quantity, 'decrease');
            }
          }
        }
      } else {
        // 출고 처리 - 출발지가 창고인 경우만 재고 차감
        if (warehouses.find(w => w.id === transaction.fromLocation)) {
          if (newInventory[transaction.fromLocation] && 
              newInventory[transaction.fromLocation][transaction.productId]) {
            newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            
            // 서버에 재고 업데이트
            inventoryApi.upsert(transaction.fromLocation, transaction.productId, newInventory[transaction.fromLocation][transaction.productId]);
            
            // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
            const warehouse = warehouses.find(w => w.id === transaction.fromLocation);
            if (warehouse?.syncWithProductStock) {
              updateProductStock(transaction.productId, -transaction.quantity, 'decrease');
            }
          }
        }
        
        // 목적지가 창고인 경우만 재고 증가 (창고→창고 이동)
        if (warehouses.find(w => w.id === transaction.toLocation)) {
          if (!newInventory[transaction.toLocation]) {
            newInventory[transaction.toLocation] = {};
          }
          if (!newInventory[transaction.toLocation][transaction.productId]) {
            newInventory[transaction.toLocation][transaction.productId] = 0;
          }
          newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          
          // 서버에 재고 업데이트
          inventoryApi.upsert(transaction.toLocation, transaction.productId, newInventory[transaction.toLocation][transaction.productId]);
          
          // 창고 A(연동 창고)의 경우 실제 상품 재고도 업데이트
          const warehouse = warehouses.find(w => w.id === transaction.toLocation);
          if (warehouse?.syncWithProductStock) {
            updateProductStock(transaction.productId, transaction.quantity, 'increase');
          }
        }
        
        // 목적지가 대리점인 경우는 재고 관리하지 않음 (출고 기록만)
      }
      
      return newInventory;
    });
  };`;

const newUpdateInventoryStr = `  const updateInventory = async (transaction) => {
    let nextInventory = null;
    
    // 1. 로컬 상태 계산
    await new Promise(resolve => {
      setInventory(prev => {
        const newInventory = JSON.parse(JSON.stringify(prev || {}));
        
        if (transaction.type === 'in') {
          if (warehouses.find(w => w.id === transaction.toLocation)) {
            if (!newInventory[transaction.toLocation]) newInventory[transaction.toLocation] = {};
            if (!newInventory[transaction.toLocation][transaction.productId]) newInventory[transaction.toLocation][transaction.productId] = 0;
            newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          }
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (newInventory[transaction.fromLocation] && newInventory[transaction.fromLocation][transaction.productId]) {
              newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            }
          }
        } else {
          if (warehouses.find(w => w.id === transaction.fromLocation)) {
            if (newInventory[transaction.fromLocation] && newInventory[transaction.fromLocation][transaction.productId]) {
              newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
            }
          }
          if (warehouses.find(w => w.id === transaction.toLocation)) {
            if (!newInventory[transaction.toLocation]) newInventory[transaction.toLocation] = {};
            if (!newInventory[transaction.toLocation][transaction.productId]) newInventory[transaction.toLocation][transaction.productId] = 0;
            newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
          }
        }
        
        nextInventory = newInventory;
        resolve();
        return newInventory;
      });
    });

    // 2. 서버 재고 업데이트 및 동기화 (await 적용)
    if (transaction.type === 'in') {
      if (warehouses.find(w => w.id === transaction.toLocation)) {
        await inventoryApi.upsert(transaction.toLocation, transaction.productId, nextInventory[transaction.toLocation][transaction.productId]);
        const warehouse = warehouses.find(w => w.id === transaction.toLocation);
        if (warehouse?.syncWithProductStock) {
          await updateProductStock(transaction.productId, transaction.quantity, 'increase');
        }
      }
      if (warehouses.find(w => w.id === transaction.fromLocation)) {
        await inventoryApi.upsert(transaction.fromLocation, transaction.productId, nextInventory[transaction.fromLocation][transaction.productId]);
        const warehouse = warehouses.find(w => w.id === transaction.fromLocation);
        if (warehouse?.syncWithProductStock) {
          await updateProductStock(transaction.productId, -transaction.quantity, 'decrease');
        }
      }
    } else {
      if (warehouses.find(w => w.id === transaction.fromLocation)) {
        await inventoryApi.upsert(transaction.fromLocation, transaction.productId, nextInventory[transaction.fromLocation][transaction.productId]);
        const warehouse = warehouses.find(w => w.id === transaction.fromLocation);
        if (warehouse?.syncWithProductStock) {
          await updateProductStock(transaction.productId, -transaction.quantity, 'decrease');
        }
      }
      if (warehouses.find(w => w.id === transaction.toLocation)) {
        await inventoryApi.upsert(transaction.toLocation, transaction.productId, nextInventory[transaction.toLocation][transaction.productId]);
        const warehouse = warehouses.find(w => w.id === transaction.toLocation);
        if (warehouse?.syncWithProductStock) {
          await updateProductStock(transaction.productId, transaction.quantity, 'increase');
        }
      }
    }
  };`;

// replace old with new
content = content.replace(oldUpdateInventoryStr, newUpdateInventoryStr);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed InventoryLayout.jsx async updates');
