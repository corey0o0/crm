const fs = require('fs');

function cleanFile(path) {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Remove ReceiptScanner import
    content = content.replace(/import ReceiptScanner from '\.\.\/Receipt\/ReceiptScanner';\n/g, '');

    // 2. Remove states
    content = content.replace(/  const \[openReceiptDialog, setOpenReceiptDialog\] = useState\(false\);\n/g, '');
    content = content.replace(/  const \[receiptLink, setReceiptLink\] = useState\(''\);\n/g, '');
    content = content.replace(/  const \[receiptPreviewAnchor, setReceiptPreviewAnchor\] = useState\(null\);\n/g, '');

    // 3. Remove useEffect dependencies & AutoSave
    content = content.replace(/      receiptLink\n/g, '');
    content = content.replace(/, receiptLink/g, '');
    content = content.replace(/        receiptLink: '',\n/g, '');
    content = content.replace(/          receipt_link: row\['JPG'\] \|\| '',\n/g, '');
    content = content.replace(/        receipt_link: receiptLink,\n/g, '');
    content = content.replace(/          receiptLink: serviceData\.receipt_link \|\| ''\n/g, '');
    
    // 4. Form data initialization
    content = content.replace(/    if \(formData\?\.receipt_link\) \{\n      setReceiptLink\(formData\.receipt_link\);\n    \}\n/g, '');
    content = content.replace(/        receipt_link: formData\.receipt_link,\n/g, '');

    // 5. Functions
    // Remove analyzeReceiptImage block
    const analyzeStart = content.indexOf('const analyzeReceiptImage = async (imageData) => {');
    if (analyzeStart !== -1) {
        let bracketCount = 0;
        let i = analyzeStart;
        while (i < content.length) {
            if (content[i] === '{') bracketCount++;
            if (content[i] === '}') {
                bracketCount--;
                if (bracketCount === 0) {
                    content = content.substring(0, analyzeStart) + content.substring(i + 1);
                    break;
                }
            }
            i++;
        }
    }
    
    // Handlers
    content = content.replace(/  const handleOpenReceiptScanner = \(\) => \{\n    setOpenReceiptDialog\(true\);\n  \};\n\n  const handleCloseReceiptScanner = \(\) => \{\n    setOpenReceiptDialog\(false\);\n  \};\n/g, '');
    content = content.replace(/    handleCloseReceiptScanner\(\);\n/g, '');
    content = content.replace(/  const handleReceiptMouseEnter = \(event\) => \{[\s\S]*?\};\n\n  const handleReceiptMouseLeave = \(\) => \{[\s\S]*?\};\n/g, '');
    content = content.replace(/  const ReceiptPreview = \(\{ url \}\) => \{[\s\S]*?  \};\n/g, '');
    content = content.replace(/  const handleReceiptLinkChange = \(e\) => \{[\s\S]*?  \};\n/g, '');

    // Handle JSON parse for AddService restore
    content = content.replace(/      const \{ formData, selectedParts, tags, receiptLink, status \} = JSON\.parse\(temp\);\n/g, '      const { formData, selectedParts, tags, status } = JSON.parse(temp);\n');
    content = content.replace(/      setReceiptLink\(receiptLink\);\n/g, '');
    content = content.replace(/                setReceiptLink\(savedData\.receiptLink \|\| ''\);\n/g, '');

    // 6. UI replacements
    // Button "영수증으로 부품 추가"
    const btnMatch1 = content.match(/<Button[^>]*?onClick=\{handleOpenReceiptScanner\}[^>]*?>\s*영수증으로 부품 추가\s*<\/Button>/);
    if(btnMatch1) content = content.replace(btnMatch1[0], '');
    
    const btnMatch2 = content.match(/<Button[^>]*?onClick=\{\(\) => setOpenReceiptDialog\(true\)\}[^>]*?>\s*영수증으로 부품 추가\s*<\/Button>/);
    if(btnMatch2) content = content.replace(btnMatch2[0], '');

    // TextField "영수증 링크" / "영수증"
    // Instead of regex, let's find `<Box sx={{ flex: 1 }}>\n          <TextField\n            size="small"\n            label="영수증` or similar.
    const tfIndex = content.indexOf('label="영수증"');
    if (tfIndex !== -1) {
        // find the preceding <Box
        const boxStart = content.lastIndexOf('<Box', tfIndex);
        if (boxStart !== -1) {
            // we need to find the matching </Box>
            let tagStack = [];
            let current = boxStart;
            let endBox = -1;
            while(current < content.length) {
                if (content.substr(current, 4) === '<Box') tagStack.push('Box');
                if (content.substr(current, 5) === '</Box') {
                    tagStack.pop();
                    if(tagStack.length === 0) {
                        endBox = current + 6; // length of </Box>
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
    
    // ReceiptScanner Dialog
    // Find `{/* 영수증 스캐너 다이얼로그 */}` or search for `<Dialog` that contains `open={openReceiptDialog}`
    const rDialogIndex = content.indexOf('open={openReceiptDialog}');
    if (rDialogIndex !== -1) {
        const dialogStart = content.lastIndexOf('<Dialog', rDialogIndex);
        if (dialogStart !== -1) {
            // Find preceding comment if exists
            let actualStart = dialogStart;
            const commentStr = '{/* 영수증 스캐너 다이얼로그 */}';
            const commentStart = content.lastIndexOf(commentStr, dialogStart);
            if (commentStart !== -1 && dialogStart - commentStart < 50) {
                actualStart = commentStart;
            }
            
            let tagStack = [];
            let current = dialogStart;
            let endDialog = -1;
            while(current < content.length) {
                if (content.substr(current, 7) === '<Dialog' && content.charAt(current+7) !== 'A' && content.charAt(current+7) !== 'T' && content.charAt(current+7) !== 'C') tagStack.push('Dialog');
                if (content.substr(current, 8) === '</Dialog') {
                    tagStack.pop();
                    if(tagStack.length === 0) {
                        endDialog = current + 9; // length of </Dialog>
                        break;
                    }
                }
                current++;
            }
            if (endDialog !== -1) {
                content = content.substring(0, actualStart) + content.substring(endDialog);
            }
        }
    }

    // ReceiptPreview component usage: {receiptPreviewAnchor && <ReceiptPreview url={receiptLink} />}
    content = content.replace(/\{receiptPreviewAnchor && <ReceiptPreview url=\{receiptLink\} \/>\}/g, '');
    
    // ServiceDetail only:
    content = content.replace(/<TextField\n\s*name="receipt_link"[\s\S]*?<\/Box>/, '</Box>');

    fs.writeFileSync(path, content);
}

cleanFile('./src/components/Service/AddService.jsx');
cleanFile('./src/components/Service/ServiceDetail.jsx');

console.log('Cleaned AddService.jsx and ServiceDetail.jsx');
