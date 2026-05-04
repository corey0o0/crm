const fs = require('fs');

function cleanFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Remove Imports
    content = content.replace(/import ReceiptScanner from '\.\.\/Receipt\/ReceiptScanner';\n/g, '');

    // 2. Remove states
    content = content.replace(/  const \[openReceiptDialog, setOpenReceiptDialog\] = useState\(false\);\n/g, '');
    content = content.replace(/  const \[receiptLink, setReceiptLink\] = useState\(''\);\n/g, '');
    content = content.replace(/  const \[receiptPreviewAnchor, setReceiptPreviewAnchor\] = useState\(null\);\n/g, '');

    // 3. Remove dependencies
    content = content.replace(/,\n      receiptLink/g, '');
    content = content.replace(/      receiptLink,\n/g, '');
    content = content.replace(/, receiptLink/g, '');
    content = content.replace(/        receiptLink: '',\n/g, '');
    content = content.replace(/        receipt_link: receiptLink,\n/g, '');
    content = content.replace(/          receipt_link: row\['JPG'\] \|\| '',\n/g, '');
    content = content.replace(/          receiptLink: serviceData\.receipt_link \|\| ''\n/g, '');

    // 4. Form data handling
    content = content.replace(/    if \(formData\?\.receipt_link\) \{\n      setReceiptLink\(formData\.receipt_link\);\n    \}\n/g, '');
    content = content.replace(/        receipt_link: formData\.receipt_link,\n/g, '');
    
    // JSON parse fixes
    content = content.replace(/const \{ formData, selectedParts, tags, receiptLink, status \} = JSON\.parse\(temp\);/, 'const { formData, selectedParts, tags, status } = JSON.parse(temp);');
    content = content.replace(/      setReceiptLink\(receiptLink\);\n/, '');
    content = content.replace(/                setReceiptLink\(savedData\.receiptLink \|\| ''\);\n/, '');

    // 5. Functions
    // Handlers
    content = content.replace(/  const handleOpenReceiptScanner = \(\) => \{\n    setOpenReceiptDialog\(true\);\n  \};\n\n  const handleCloseReceiptScanner = \(\) => \{\n    setOpenReceiptDialog\(false\);\n  \};\n/g, '');
    content = content.replace(/    handleCloseReceiptScanner\(\);\n/g, '');
    content = content.replace(/  const handleReceiptMouseEnter = \(event\) => \{[\s\S]*?\};\n\n  const handleReceiptMouseLeave = \(\) => \{[\s\S]*?\};\n/g, '');
    content = content.replace(/  const handleReceiptLinkChange = \(e\) => \{[\s\S]*?  \};\n/g, '');

    // 6. UI
    // Button "영수증으로 부품 추가"
    content = content.replace(/                  <Button\n                    startIcon=\{<ReceiptIcon \/>\}\n                    variant="outlined"\n                    onClick=\{handleOpenReceiptScanner\}\n                    sx=\{\{ \n                      color: '#3182f6',\n                      borderColor: '#3182f6',\n                      '&:hover': \{ \n                        bgcolor: 'rgba\(49, 130, 246, 0.04\)',\n                        borderColor: '#1b64da'\n                      \}\n                    \}\}\n                  >\n                    영수증으로 부품 추가\n                  <\/Button>\n/g, '');
    
    content = content.replace(/                  <Button\n                    startIcon=\{<ReceiptIcon \/>\}\n                    variant="outlined"\n                    onClick=\{\(\) => setOpenReceiptDialog\(true\)\}\n                    sx=\{\{\n                      color: '#3182f6',\n                      borderColor: '#3182f6',\n                      '&:hover': \{\n                        bgcolor: 'rgba\(49, 130, 246, 0.04\)',\n                        borderColor: '#1b64da'\n                      \}\n                    \}\}\n                  >\n                    영수증으로 부품 추가\n                  <\/Button>\n/g, '');

    // TextField Box "영수증 링크" / "영수증"
    // Use substring replacement based on indexOf for exact bounding
    const findAndRemoveBox = (labelStr) => {
        const tfIndex = content.indexOf(`label="${labelStr}"`);
        if (tfIndex !== -1) {
            const boxStart = content.lastIndexOf('<Box', tfIndex);
            if (boxStart !== -1) {
                let current = boxStart;
                let tagStack = 0;
                let endBox = -1;
                while (current < content.length) {
                    if (content.substr(current, 4) === '<Box') tagStack++;
                    if (content.substr(current, 5) === '</Box') {
                        tagStack--;
                        if (tagStack === 0) {
                            endBox = current + 6;
                            break;
                        }
                    }
                    current++;
                }
                if (endBox !== -1) {
                    content = content.substring(0, boxStart) + content.substring(endBox);
                }
            }
        }
    };
    findAndRemoveBox("영수증 링크");
    findAndRemoveBox("영수증");

    // Dialog for ReceiptScanner
    const findAndRemoveDialog = () => {
        const dIndex = content.indexOf('open={openReceiptDialog}');
        if (dIndex !== -1) {
            const dialogStart = content.lastIndexOf('<Dialog', dIndex);
            if (dialogStart !== -1) {
                let current = dialogStart;
                let tagStack = 0;
                let endDialog = -1;
                while (current < content.length) {
                    // Match <Dialog exactly, not <DialogTitle or <DialogContent
                    if (content.substr(current, 7) === '<Dialog' && !['T','C','A'].includes(content.charAt(current+7))) tagStack++;
                    if (content.substr(current, 8) === '</Dialog') {
                        tagStack--;
                        if (tagStack === 0) {
                            endDialog = current + 9;
                            break;
                        }
                    }
                    current++;
                }
                if (endDialog !== -1) {
                    // remove preceding comment if exists
                    const preceding = content.substring(Math.max(0, dialogStart - 100), dialogStart);
                    let actualStart = dialogStart;
                    if (preceding.includes('{/* 영수증 스캐너 다이얼로그 */}')) {
                        actualStart = dialogStart - (preceding.length - preceding.lastIndexOf('{/* 영수증 스캐너 다이얼로그 */}'));
                    }
                    content = content.substring(0, actualStart) + content.substring(endDialog);
                }
            }
        }
    };
    findAndRemoveDialog();

    // ReceiptPreview component usage: {receiptPreviewAnchor && <ReceiptPreview url={receiptLink} />}
    content = content.replace(/\{receiptPreviewAnchor && <ReceiptPreview url=\{receiptLink\} \/>\}/g, '');
    
    // ReceiptPreview Definition
    const rpStart = content.indexOf('const ReceiptPreview = ({ url }) => {');
    if (rpStart !== -1) {
        let current = rpStart;
        let braceStack = 0;
        let endRp = -1;
        while (current < content.length) {
            if (content[current] === '{') braceStack++;
            if (content[current] === '}') {
                braceStack--;
                if (braceStack === 0) {
                    // Handle the trailing semicolon and newline if any
                    endRp = current + 1;
                    if (content[endRp] === ';') endRp++;
                    if (content[endRp] === '\n') endRp++;
                    break;
                }
            }
            current++;
        }
        if (endRp !== -1) {
            content = content.substring(0, rpStart) + content.substring(endRp);
        }
    }

    fs.writeFileSync(path, content);
}

cleanFile('./src/components/Service/AddService.jsx');
cleanFile('./src/components/Service/ServiceDetail.jsx');

console.log('Cleaned files');
