const fs = require('fs');

const path = './src/components/Service/ServiceList.jsx';
let content = fs.readFileSync(path, 'utf8');

// Remove processImage, convertToBase64, processOcrResult, handleFileUpload, handleOcrItemHover, handleOcrItemSelect, handleApplyOcrResults

// Instead of complex regex, let's just replace the blocks exactly or find boundaries.
// Since it's large, let's use some regex to strip functions out.

content = content.replace(/const processImage = async \([\s\S]*?catch \(error\) \{\n\s*console\.error\('OCR 처리 실패:', error\);\n\s*throw error;\n\s*\}\n\s*\};/m, '');
content = content.replace(/const convertToBase64 = \([\s\S]*?\}\);\n\s*\};/m, '');
content = content.replace(/const processOcrResult = \([\s\S]*?return extractedItems;\n\s*\};/m, '');
content = content.replace(/const handleFileUpload = async \([\s\S]*?setOcrProgress\(0\);\n\s*\};/m, '');
content = content.replace(/const handleOcrItemHover = \([\s\S]*?\)\);\n\s*\};/m, '');
content = content.replace(/const handleOcrItemSelect = \([\s\S]*?\)\);\n\s*\};/m, '');
content = content.replace(/const handleApplyOcrResults = \([\s\S]*?setSelectedOcrItems\(\{\}\);\n\s*\};/m, '');

// UI cleanup: OCR progress
content = content.replace(/\{\s*ocrProgress > 0[\s\S]*?\}\s*\)/m, '');

// UI cleanup: file upload button
const fileUploadPattern = /\{\/\* 파일 업로드 버튼 \*\/\}\s*<Box sx=\{\{ mb: 2 \}\}>[\s\S]*?<\/Box>/m;
content = content.replace(fileUploadPattern, '');

// UI cleanup: uploaded files and OCR results
const uploadedFilesPattern = /\{\/\* 업로드된 파일 목록 \*\/\}[\s\S]*?\{\/\* OCR 결과 \*\/\}/m;
// This might be tricky, let's use exact strings if possible.

fs.writeFileSync(path, content, 'utf8');
console.log('Removed OCR functions');
