const fs = require('fs');
const path = './src/components/Service/AddService.jsx';
let content = fs.readFileSync(path, 'utf8');

// handleReceiptMouseEnter / Leave
content = content.replace(/  const handleReceiptMouseEnter = \(event\) => {[\s\S]*?};\n\n  const handleReceiptMouseLeave = \(\) => {[\s\S]*?};\n/g, '');

// The "영수증으로 부품 추가" button and textfield logic (around line 3090+)
const buttonAndInputRegex = /                  <Button\n                    startIcon=\{<ReceiptIcon \/>\}[\s\S]*?영수증으로 부품 추가\n                  <\/Button>\n                <\/Box>\n                <Box sx=\{\{ flex: 1 \}\}>\n                  <TextField\n                    label="영수증 링크"[\s\S]*?<\/Box>/;
content = content.replace(buttonAndInputRegex, '                </Box>');

// The ReceiptScanner Dialog
const dialogRegex = /      \{\/\* 영수증 스캐너 다이얼로그 \*\/\}[\s\S]*?<\/Dialog>/;
content = content.replace(dialogRegex, '');

fs.writeFileSync(path, content);
console.log('Done cleaning UI from AddService.jsx');
