const fs = require('fs');
let code = fs.readFileSync('src/pages/sales/ManualSalesList.jsx', 'utf8');
code = code.replace(
  /fetchManualSales\(\);\n\s*setDeleteDialog\(false\);\n\s*\} finally \{/,
  `fetchManualSales();\n    } catch (err) {\n      setSnackbar({ open: true, message: '삭제 실패: ' + err.message, severity: 'error' });\n    } finally {`
);
fs.writeFileSync('src/pages/sales/ManualSalesList.jsx', code);
