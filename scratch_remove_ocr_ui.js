const fs = require('fs');

const path = './src/components/Service/ServiceList.jsx';
let content = fs.readFileSync(path, 'utf8');

// The block starts with <Grid item xs={12}> and Alert for OCR results
const ocrUIRegex = /<Grid item xs=\{12\}>\s*<Alert\s*severity="success"[\s\S]*?<\/Grid>/;
content = content.replace(ocrUIRegex, '');

// State variables
content = content.replace(/const \[ocrProgress, setOcrProgress\] = useState\(0\);\n/g, '');
content = content.replace(/const \[ocrResults, setOcrResults\] = useState\(\[\]\);\n/g, '');
content = content.replace(/const \[selectedOcrItems, setSelectedOcrItems\] = useState\(\{\}\);\n/g, '');
content = content.replace(/const \[ocrBoxes, setOcrBoxes\] = useState\(\[\]\);\n/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Removed OCR UI');
