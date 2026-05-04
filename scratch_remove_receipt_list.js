const fs = require('fs');
const path = './src/components/Service/ServiceList.jsx';
let content = fs.readFileSync(path, 'utf8');

// The Grid item containing the Stepper and LinearProgress
const uploadUiRegex = /            <Grid item xs=\{12\}>\n              <Typography variant="subtitle1" gutterBottom>\n                영수증\/이미지 업로드\n              <\/Typography>[\s\S]*?<\/Grid>\n/g;
content = content.replace(uploadUiRegex, '');

fs.writeFileSync(path, content);
console.log('Done cleaning ServiceList.jsx');
