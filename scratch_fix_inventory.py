import re
import sys

file_path = '/Users/weird/Desktop/Work/AS/crm-app/src/pages/inventory/InventoryLayout.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update parseInt
# We replace parseInt(X) with parseInt(X, 10)
# We only match simple cases that don't have commas inside them
# For nested structures, we'll replace specifically

replacements = [
    ("parseInt(item.productId)", "parseInt(item.productId, 10)"),
    ("parseInt(item.quantity)", "parseInt(item.quantity, 10)"),
    ("parseInt(rowData[product.col])", "parseInt(rowData[product.col], 10)"),
    ("parseInt(rowData[4])", "parseInt(rowData[4], 10)"),
    ("parseInt(product.id)", "parseInt(product.id, 10)"),
    ("parseInt(it.quantity)", "parseInt(it.quantity, 10)"),
    ("parseInt(g.items[0].quantity)", "parseInt(g.items[0].quantity, 10)"),
    ("parseInt(product.productId)", "parseInt(product.productId, 10)"),
    ("parseInt(product.quantity)", "parseInt(product.quantity, 10)"),
    ("parseInt(e.target.value)", "parseInt(e.target.value, 10)")
]

for old, new in replacements:
    content = content.replace(old, new)

# 2. Update updateInventory function
old_update = """  const updateInventory = async (transaction) => {
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
    });"""

new_update = """  const updateInventory = async (transaction) => {
    let nextInventory = null;
    let inventoryError = null;
    
    // 1. 로컬 상태 계산
    await new Promise(resolve => {
      setInventory(prev => {
        const newInventory = JSON.parse(JSON.stringify(prev || {}));
        
        try {
          if (transaction.type === 'in') {
            if (warehouses.find(w => w.id === transaction.toLocation)) {
              if (!newInventory[transaction.toLocation]) newInventory[transaction.toLocation] = {};
              if (!newInventory[transaction.toLocation][transaction.productId]) newInventory[transaction.toLocation][transaction.productId] = 0;
              newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
            }
            if (warehouses.find(w => w.id === transaction.fromLocation)) {
              if (newInventory[transaction.fromLocation] && newInventory[transaction.fromLocation][transaction.productId]) {
                const current = newInventory[transaction.fromLocation][transaction.productId];
                if (current < transaction.quantity) throw new Error(`재고 부족: [${transaction.fromLocation}]에서 [${transaction.productName}]의 재고가 부족합니다. (현재: ${current})`);
                newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
              }
            }
          } else {
            if (warehouses.find(w => w.id === transaction.fromLocation)) {
              if (newInventory[transaction.fromLocation] && newInventory[transaction.fromLocation][transaction.productId]) {
                const current = newInventory[transaction.fromLocation][transaction.productId];
                if (current < transaction.quantity) throw new Error(`재고 부족: [${transaction.fromLocation}]에서 [${transaction.productName}]의 재고가 부족합니다. (현재: ${current})`);
                newInventory[transaction.fromLocation][transaction.productId] -= transaction.quantity;
              }
            }
            if (warehouses.find(w => w.id === transaction.toLocation)) {
              if (!newInventory[transaction.toLocation]) newInventory[transaction.toLocation] = {};
              if (!newInventory[transaction.toLocation][transaction.productId]) newInventory[transaction.toLocation][transaction.productId] = 0;
              newInventory[transaction.toLocation][transaction.productId] += transaction.quantity;
            }
          }
        } catch (e) {
          inventoryError = e;
          resolve();
          return prev;
        }
        
        nextInventory = newInventory;
        resolve();
        return newInventory;
      });
    });

    if (inventoryError) throw inventoryError;"""

content = content.replace(old_update, new_update)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully")
