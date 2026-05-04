const fs = require('fs');
const path = './src/components/Service/ServiceDetail.jsx';
let content = fs.readFileSync(path, 'utf8');

// The Button and TextField for receipt
content = content.replace(/<Box sx=\{\{ flex: 1 \}\}>\n\s*<TextField\n\s*label="영수증 링크"[\s\S]*?<\/Box>/, '');

// Wait, the error is at Line 2355:29: 'receiptLink' is not defined etc.
// Let's remove all references to receiptLink and openReceiptDialog that still exist.
// This means the regex in previous script missed them.

// Find all matches and remove them
content = content.replace(/receiptLink: '',\n/g, '');
content = content.replace(/value=\{receiptLink\}[\s\S]*?onChange=\{e => setReceiptLink\(e.target.value\)\}[\s\S]*?onMouseEnter=\{handleReceiptMouseEnter\}[\s\S]*?onMouseLeave=\{handleReceiptMouseLeave\}[\s\S]*?<\/Box>/g, '');

content = content.replace(/<Dialog[\s\S]*?open=\{openReceiptDialog\}[\s\S]*?<\/Dialog>/g, '');

content = content.replace(/<Button[\s\S]*?onClick=\{handleOpenReceiptScanner\}[\s\S]*?영수증으로 부품 추가\n\s*<\/Button>/g, '');

content = content.replace(/<Button[\s\S]*?onClick=\{\(\) => setOpenReceiptDialog\(true\)\}[\s\S]*?영수증으로 부품 추가\n\s*<\/Button>/g, '');

// Since these are specific chunks, maybe I should just use `sed` or `awk`? 
// No, I'll view the specific lines from the error log.
fs.writeFileSync(path, content);
