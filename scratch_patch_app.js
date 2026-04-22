const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/App.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('import EcountDataUploader')) {
  // Add after Cafe24OrderList
  content = content.replace(
    "import Cafe24OrderList from './pages/cafe24/Cafe24OrderList';",
    "import Cafe24OrderList from './pages/cafe24/Cafe24OrderList';\nimport EcountDataUploader from './components/Settings/EcountDataUploader';"
  );
}

// 2. Add route
if (!content.includes('path="settings/ecount-uploader"')) {
  content = content.replace(
    '          <Route path="settings/cafe24" element={<Cafe24Settings />} />',
    '          <Route path="settings/ecount-uploader" element={<EcountDataUploader />} />\n          <Route path="settings/cafe24" element={<Cafe24Settings />} />'
  );
}

fs.writeFileSync(file, content);
console.log('Script ran successfully');
