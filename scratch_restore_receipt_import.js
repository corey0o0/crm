const fs = require('fs');

const detailPath = './src/components/Service/ServiceDetail.jsx';
let detail = fs.readFileSync(detailPath, 'utf8');
if (!detail.includes("import ReceiptIcon from '@mui/icons-material/Receipt';")) {
    detail = detail.replace(/import {([^}]+)} from '@mui\/icons-material';/, "import {\n  Receipt as ReceiptIcon,$1} from '@mui/icons-material';");
    fs.writeFileSync(detailPath, detail);
}

const addPath = './src/components/Service/AddService.jsx';
let add = fs.readFileSync(addPath, 'utf8');
if (!add.includes("Receipt as ReceiptIcon")) {
    add = add.replace(/import {([^}]+)} from '@mui\/icons-material';/, "import {\n  Receipt as ReceiptIcon,$1} from '@mui/icons-material';");
    fs.writeFileSync(addPath, add);
}

console.log('Restored ReceiptIcon imports');
