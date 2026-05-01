const fs = require('fs');
const files = [
  'src/pages/inventory/InventoryLayout.jsx',
  'src/pages/inventory/InventoryHistory.jsx',
  'src/pages/inventory/InventoryStatus.jsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/'\.\/tabs\//g, "'../../components/Inventory/tabs/");
    content = content.replace(/'\.\/Cafe24InventoryReconciliation'/g, "'../../components/Inventory/Cafe24InventoryReconciliation'");
    content = content.replace(/'\.\/LocationManagement'/g, "'../../components/Inventory/LocationManagement'");
    content = content.replace(/'\.\/BarcodeScanner'/g, "'../../components/Inventory/BarcodeScanner'");
    fs.writeFileSync(file, content);
    console.log('Fixed imports in', file);
  }
});
