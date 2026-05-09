const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, 'src/pages/inventory/InventoryLayout.jsx');
const historyPath = path.join(__dirname, 'src/pages/inventory/InventoryHistory.jsx');

let layoutCode = fs.readFileSync(layoutPath, 'utf8').split('\n');
let historyCode = fs.readFileSync(historyPath, 'utf8').split('\n');

// Find the indices
const layoutReturnIdx = layoutCode.findIndex(line => line.includes('return ('));
const outletIdx = layoutCode.findIndex(line => line.includes('<Outlet context={contextValue} />'));
const layoutEndIdx = layoutCode.length - 1;

// Find the last </Box> before the closing brace in layout to know where it ends exactly
let lastBoxIdx = -1;
for (let i = layoutCode.length - 1; i >= 0; i--) {
  if (layoutCode[i].includes('</Box>')) {
    lastBoxIdx = i;
    break;
  }
}

// Extract header block: from just after 'return (' box to just before <Outlet />
// Actually, let's just grab the whole Box containing the header
let headerStartIdx = -1;
let headerEndIdx = outletIdx - 1;
for (let i = outletIdx - 1; i >= 0; i--) {
  if (layoutCode[i].includes('{/* 헤더 */}')) {
    headerStartIdx = i - 1; // get the <Box> above it
    break;
  }
}

const headerBlock = layoutCode.slice(headerStartIdx, headerEndIdx + 1);

// Extract dialogs block: from just after <Outlet /> to just before the last </Box>
const dialogsBlock = layoutCode.slice(outletIdx + 1, lastBoxIdx);

// Now modify InventoryLayout.jsx
// It should just be:
// return (
//   <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
//     <Outlet context={contextValue} />
//   </Box>
// );
const newLayoutCode = [
  ...layoutCode.slice(0, layoutReturnIdx + 1),
  "    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>",
  "      <Outlet context={contextValue} />",
  "    </Box>",
  "  );",
  "}",
  "",
  "export default InventoryLayout;"
];

// Now modify InventoryHistory.jsx
// Insert header block at the beginning of the return Box
const historyReturnIdx = historyCode.findIndex(line => line.includes('<Box>'));
const newHistoryCode = [
  ...historyCode.slice(0, historyReturnIdx + 1),
  ...headerBlock,
  ...historyCode.slice(historyReturnIdx + 1, historyCode.length - 3), // skip closing tags for now
];

// Find the exact end of History
let hLastBox = -1;
for (let i = historyCode.length - 1; i >= 0; i--) {
  if (historyCode[i].includes('</Box>')) {
    hLastBox = i;
    break;
  }
}

const historyTopPart = historyCode.slice(0, hLastBox);
const historyBottomPart = historyCode.slice(hLastBox);

const finalHistoryCode = [
  ...historyTopPart.slice(0, historyReturnIdx + 1),
  ...headerBlock,
  ...historyTopPart.slice(historyReturnIdx + 1),
  ...dialogsBlock,
  ...historyBottomPart
];

fs.writeFileSync(layoutPath, newLayoutCode.join('\n'));
fs.writeFileSync(historyPath, finalHistoryCode.join('\n'));

console.log('Split successful.');
