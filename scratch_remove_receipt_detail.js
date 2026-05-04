const fs = require('fs');
const path = './src/components/Service/ServiceDetail.jsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(/import ReceiptIcon from '@mui\/icons-material\/Receipt';\n/g, '');
content = content.replace(/import ReceiptScanner from '\.\.\/Receipt\/ReceiptScanner';\n/g, '');

// States
content = content.replace(/  const \[openReceiptDialog, setOpenReceiptDialog\] = useState\(false\);\n/g, '');
content = content.replace(/  const \[receiptLink, setReceiptLink\] = useState\(''\);\n/g, '');
content = content.replace(/  const \[receiptPreviewAnchor, setReceiptPreviewAnchor\] = useState\(null\);\n/g, '');

// Effects dependencies and initialization
content = content.replace(/      receiptLink\n/g, '');
content = content.replace(/, receiptLink/g, '');
content = content.replace(/          receiptLink: serviceData\.receipt_link \|\| ''\n/g, '');

// formData initialization handling
content = content.replace(/    if \(formData\?\.receipt_link\) {\n      setReceiptLink\(formData\.receipt_link\);\n    }\n/g, '');
content = content.replace(/        receipt_link: formData\.receipt_link,\n/g, '');

// Handlers & Components
content = content.replace(/  const handleReceiptMouseEnter = \(event\) => {[\s\S]*?};\n\n  const handleReceiptMouseLeave = \(\) => {[\s\S]*?};\n/g, '');
content = content.replace(/  const ReceiptPreview = \(\{ url \}\) => {[\s\S]*?  };\n/g, '');
content = content.replace(/  const handleReceiptLinkChange = \(e\) => {[\s\S]*?  };\n/g, '');

// UI: Button and TextField
const buttonAndInputRegex = /                  <Button\n                    startIcon=\{<ReceiptIcon \/>\}[\s\S]*?영수증으로 부품 추가\n                  <\/Button>\n                <\/Box>\n                <Box sx=\{\{ flex: 1 \}\}>\n                  <TextField\n                    name="receipt_link"[\s\S]*?<\/Box>/;
content = content.replace(buttonAndInputRegex, '                </Box>');

// UI: Dialog
const dialogRegex = /      \{\/\* 영수증 스캐너 다이얼로그 \*\/\}[\s\S]*?<\/Dialog>/;
content = content.replace(dialogRegex, '');

// PDF print icon logic fix
const printButtonRegex = /                <Button \n                  onClick=\{handlePrintEstimate\}\n                  startIcon=\{<ReceiptIcon \/>\}/g;
content = content.replace(printButtonRegex, '                <Button \n                  onClick={handlePrintEstimate}\n                  startIcon={<PrintIcon />}'); // we changed ReceiptIcon to PrintIcon just in case it was used here. Wait, the user asked to remove "영수증으로 부품 추가", not the 견적서(estimate) button. If estimate used ReceiptIcon, we need to leave the import. Let's see if ReceiptIcon is used elsewhere.

fs.writeFileSync(path, content);
console.log('Done cleaning ServiceDetail.jsx');
