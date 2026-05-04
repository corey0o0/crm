const fs = require('fs');
const path = './src/components/Service/AddService.jsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(/import ReceiptScanner from '\.\.\/Receipt\/ReceiptScanner';\n/g, '');
content = content.replace(/  Receipt as ReceiptIcon,\n/g, '');

// States
content = content.replace(/  const \[openReceiptDialog, setOpenReceiptDialog\] = useState\(false\);\n/g, '');
content = content.replace(/  const \[receiptLink, setReceiptLink\] = useState\(''\);\n/g, '');
content = content.replace(/  const \[receiptPreviewAnchor, setReceiptPreviewAnchor\] = useState\(null\);\n/g, '');

// AutoSave dependency arrays
content = content.replace(/      receiptLink\n/g, '');
content = content.replace(/, receiptLink/g, '');

// Form Data reset
content = content.replace(/        receiptLink: '',\n/g, '');

// receiptLink assignment in initial load or submit
content = content.replace(/          receipt_link: row\['JPG'\] \|\| '',\n/g, '');
content = content.replace(/        receipt_link: receiptLink,\n/g, '');

// analyzeReceiptImage function (remove completely)
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
content = content.replace(/  const handleOpenReceiptScanner = \(\) => {\n    setOpenReceiptDialog\(true\);\n  };\n\n  const handleCloseReceiptScanner = \(\) => {\n    setOpenReceiptDialog\(false\);\n  };\n/g, '');
content = content.replace(/    handleCloseReceiptScanner\(\);\n/g, '');

// Restore receiptLink in handleRestoreTempData
content = content.replace(/      const { formData, selectedParts, tags, receiptLink, status } = JSON\.parse\(temp\);\n/g, '      const { formData, selectedParts, tags, status } = JSON.parse(temp);\n');
content = content.replace(/      setReceiptLink\(receiptLink\);\n/g, '');

// Restore in handleConfirmRestore
content = content.replace(/                setReceiptLink\(savedData\.receiptLink \|\| ''\);\n/g, '');

fs.writeFileSync(path, content);
console.log('Done cleaning AddService.jsx');
