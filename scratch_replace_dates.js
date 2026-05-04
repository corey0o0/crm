import fs from 'fs';
const file = 'src/components/Inventory/InventoryManagement.jsx';
let content = fs.readFileSync(file, 'utf8');

// Add import if not exists
if (!content.includes("import { format } from 'date-fns'")) {
    content = content.replace("import React,", "import { format } from 'date-fns';\nimport React,");
}

// Replace new Date().toISOString().split('T')[0]
content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, "format(new Date(), 'yyyy-MM-dd')");

// Replace new Date(tx.date).toISOString().split('T')[0]
content = content.replace(/new Date\(([^)]+)\)\.toISOString\(\)\.split\('T'\)\[0\]/g, "format(new Date($1), 'yyyy-MM-dd')");

// Replace today.toISOString().split('T')[0]
content = content.replace(/today\.toISOString\(\)\.split\('T'\)\[0\]/g, "format(today, 'yyyy-MM-dd')");

// Replace startOfWeek.toISOString().split('T')[0]
content = content.replace(/startOfWeek\.toISOString\(\)\.split\('T'\)\[0\]/g, "format(startOfWeek, 'yyyy-MM-dd')");

// Replace startOfMonth.toISOString().split('T')[0]
content = content.replace(/startOfMonth\.toISOString\(\)\.split\('T'\)\[0\]/g, "format(startOfMonth, 'yyyy-MM-dd')");

// Replace d.toISOString().split('T')[0]
content = content.replace(/d\.toISOString\(\)\.split\('T'\)\[0\]/g, "format(d, 'yyyy-MM-dd')");

// Replace thisWeek.toISOString().split('T')[0]
content = content.replace(/thisWeek\.toISOString\(\)\.split\('T'\)\[0\]/g, "format(thisWeek, 'yyyy-MM-dd')");

fs.writeFileSync(file, content);
console.log('Replaced dates in InventoryManagement.jsx');
