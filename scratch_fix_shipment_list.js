const fs = require('fs');
const path = '/Users/weird/Desktop/Work/AS/crm-app/src/pages/shipment/ShipmentList.jsx';
let content = fs.readFileSync(path, 'utf8');

// replace firstPageLoaded with !loading
content = content.replace(/!firstPageLoaded/g, 'loading');
content = content.replace(/firstPageLoaded/g, '!loading');

// replace fetchFirstPage with fetchShipments
content = content.replace(/fetchFirstPage/g, 'fetchShipments');

// replace filteredShipments with shipments
content = content.replace(/filteredShipments/g, 'shipments');

// remove backgroundLoading and isLoadingNextChunk and loadProgress blocks
content = content.replace(/\{\(backgroundLoading \|\| isLoadingNextChunk\).*?\}\s*\}\n/g, '');
// Let's just remove the LinearProgress completely since it's around 1712
const regexLinearProgress = /\{\s*\(backgroundLoading \|\| isLoadingNextChunk \|\| !firstPageLoaded \|\| loading\)\s*\?\s*\(\s*<Box[^>]*>\s*<LinearProgress[^>]*\/>.*?\)\s*:\s*(<Box sx=\{\{ height: 4 \}\}\s*\/>)\s*\}/gs;
content = content.replace(regexLinearProgress, '<Box sx={{ height: 4 }} />');

// also remove any other references
content = content.replace(/isLoadingNextChunk/g, 'false');
content = content.replace(/backgroundLoading/g, 'false');
content = content.replace(/loadProgress/g, '0');
content = content.replace(/loadedChunks/g, '0');

// replace handlePageChangeWithLoading with handlePageChange
// Wait, do we have handlePageChange? Let's check TablePagination.
content = content.replace(/onChangePage=\{handlePageChangeWithLoading\}/g, 'onChangePage={(e, newPage) => setPage(newPage)}');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed undefined variables in ShipmentList.jsx');
