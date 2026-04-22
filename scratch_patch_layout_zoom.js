const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Layout.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add Icons
if (!content.includes('ZoomIn as ZoomInIcon')) {
  content = content.replace(
    '  ShoppingCartOutlined as ShoppingCartOutlinedIcon,',
    '  ShoppingCartOutlined as ShoppingCartOutlinedIcon,\n  ZoomIn as ZoomInIcon,\n  ZoomOut as ZoomOutIcon,\n  FormatSize as FormatSizeIcon,'
  );
}

// 2. Add state and logic inside Layout()
const oldHookStart = `function Layout() {
  const theme = useTheme();`;

const newHookStart = `function Layout() {
  const theme = useTheme();
  
  // 글로벌 폰트 사이즈 상태
  const [htmlFontSize, setHtmlFontSize] = useState(16);

  useEffect(() => {
    const saved = localStorage.getItem('globalFontSize');
    if (saved) {
      const size = parseInt(saved, 10);
      if (size >= 12 && size <= 24) {
        setHtmlFontSize(size);
        document.documentElement.style.fontSize = \`\${size}px\`;
      }
    }
  }, []);

  const handleZoomIn = () => {
    if (htmlFontSize < 24) {
      const newSize = htmlFontSize + 1;
      setHtmlFontSize(newSize);
      document.documentElement.style.fontSize = \`\${newSize}px\`;
      localStorage.setItem('globalFontSize', newSize.toString());
    }
  };

  const handleZoomOut = () => {
    if (htmlFontSize > 12) {
      const newSize = htmlFontSize - 1;
      setHtmlFontSize(newSize);
      document.documentElement.style.fontSize = \`\${newSize}px\`;
      localStorage.setItem('globalFontSize', newSize.toString());
    }
  };`;

if (!content.includes('const [htmlFontSize')) {
  content = content.replace(oldHookStart, newHookStart);
}

// 3. Add buttons to AppBar right side, before Wifi icon
const oldDebugPanel = `{/* 디버그 버튼 (마스터 계정 전용) */}
          <DebugPanel />`;

const newDebugPanel = `          {/* 폰트 크기 조절 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: { xs: 0, sm: 1 }, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2, px: 0.5 }}>
            <Tooltip title="글자 작게">
              <IconButton size="small" color="inherit" onClick={handleZoomOut} disabled={htmlFontSize <= 12}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold' }}>
              {htmlFontSize}
            </Typography>
            <Tooltip title="글자 크게">
              <IconButton size="small" color="inherit" onClick={handleZoomIn} disabled={htmlFontSize >= 24}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* 디버그 버튼 (마스터 계정 전용) */}
          <DebugPanel />`;

if (!content.includes('폰트 크기 조절')) {
  content = content.replace(oldDebugPanel, newDebugPanel);
}

fs.writeFileSync(file, content);
console.log('Script ran successfully');
