const fs = require('fs');

let content = fs.readFileSync('src/pages/sales/ManualSalesList.jsx', 'utf8');

// 1. 상태 추가
if (!content.includes('isAnalyzing')) {
  content = content.replace(
    /const \[searchTrigger, setSearchTrigger\] = useState\(0\);/,
    `const [searchTrigger, setSearchTrigger] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });`
  );
}

// 2. 버튼 추가
if (!content.includes('handleBulkAnalyze')) {
  content = content.replace(
    /\{\s*selectedItems\.length\s*>\s*0\s*&&\s*\(\s*<Button\s*variant="outlined"\s*color="error"\s*startIcon=\{<DeleteIcon \/>\}/m,
    `{selectedItems.length > 0 && (
                <Button 
                  variant="outlined" 
                  color="warning" 
                  onClick={() => handleBulkAnalyze()}
                  sx={{ mr: 1 }}
                >
                  선택 분석 ({selectedItems.length})
                </Button>
              )}
              {selectedItems.length > 0 && (
                <Button 
                  variant="outlined" 
                  color="error" 
                  startIcon={<DeleteIcon />}`
  );
}

// 3. 다이얼로그 추가
if (!content.includes('일괄 분석 진행 중')) {
  content = content.replace(
    /\{\/\* 일괄 삭제 모달 \*\/\}/,
    `{/* 일괄 분석 진행 모달 */}
      <Dialog open={isAnalyzing}>
        <DialogTitle>일괄 분석 진행 중...</DialogTitle>
        <DialogContent sx={{ minWidth: 300, textAlign: 'center', py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {analyzeProgress.current} / {analyzeProgress.total} 개 완료
          </Typography>
        </DialogContent>
      </Dialog>

      {/* 일괄 삭제 모달 */}`
  );
}

fs.writeFileSync('src/pages/sales/ManualSalesList.jsx', content);
