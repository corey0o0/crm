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

console.log('Cleaned states');
