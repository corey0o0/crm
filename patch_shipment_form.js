const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/shipment/ShipmentForm.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Title change
content = content.replace(
  "isManualB2B ? (isEditMode ? '수기 판매 전표 수정 (B2B)' : '새 수기 판매 전표 작성 (B2B)') : (isEditMode ? '출고 정보 수정' : '신규 출고 등록')",
  "isManualB2B ? (isEditMode ? '수기 판매 전표 수정' : '새 수기 판매 전표 작성') : (isEditMode ? '출고 정보 수정' : '신규 출고 등록')"
);

fs.writeFileSync(filePath, content);
console.log('Title updated');
