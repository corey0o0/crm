const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/pages/shipment/ShipmentForm.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. imports
content = content.replace(
  "  Chip\n} from '@mui/material';",
  "  Chip,\n  Autocomplete\n} from '@mui/material';"
);

// 2. remove auto-modifying handleChange
const oldHandleChange = `  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setShipmentData(prev => {
      const nextData = { ...prev, [name]: value };
      
      // 고객명 입력 시 대리점명과 부분 일치하면 자동으로 거래처로 연동
      if (name === 'customer_name' && value.trim().length >= 2) {
        const query = value.trim();
        const matchedAgency = agencies.find(a => a.name === query || query.includes(a.name) || a.name.includes(query));
        
        if (matchedAgency) {
          // 일치하는 대리점이 있다면 기타 정보도 연동
          nextData.sales_channel = matchedAgency.name;
          // UI 표시용으로 고객명에 대리점 추가 (만약 이미 '(대리점)'이 없다면)
          if (!query.includes('(대리점)')) {
            nextData.customer_name = \`\${query} (대리점)\`;
          }
        }
      }
      
      return nextData;
    });
  };`;

const newHandleChange = `  const handleChange = (e) => {
    const { name, value } = e.target;
    setShipmentData(prev => ({
      ...prev,
      [name]: value
    }));
  };`;

content = content.replace(oldHandleChange, newHandleChange);

// 3. update TextField
const oldGrid = `          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="고객명"
              name="customer_name"
              value={shipmentData.customer_name || ''}
              onChange={handleChange}
              required
            />
          </Grid>`;

const newGrid = `          <Grid item xs={12} md={3}>
            <Autocomplete
              freeSolo
              options={agencies.map(a => a.name)}
              value={shipmentData.customer_name || ''}
              onInputChange={(e, newValue) => {
                setShipmentData(prev => ({ ...prev, customer_name: newValue || '' }));
              }}
              onChange={(e, newValue) => {
                if (newValue) {
                  // 목록에서 대리점을 클릭/선택한 경우 거래처 자동 연동
                  const matchedAgency = agencies.find(a => a.name === newValue);
                  setShipmentData(prev => ({ 
                    ...prev, 
                    customer_name: newValue,
                    sales_channel: matchedAgency ? matchedAgency.name : prev.sales_channel
                  }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="고객명(대리점 자동완성)"
                  required
                />
              )}
            />
          </Grid>`;

content = content.replace(oldGrid, newGrid);

fs.writeFileSync(file, content);
console.log('Script ran successfully');
