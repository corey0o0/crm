const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/pages/sales/ManualSalesList.jsx');
let content = fs.readFileSync(file, 'utf8');

const oldGrid = `<Grid item xs={12} md={12} lg={4}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ width: 140, mb: { xs: 1, sm: 0 } }}>
                <InputLabel>상태</InputLabel>
                <Select
                  value={statusFilter}
                  label="상태"
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">전체 상태</MenuItem>
                  <MenuItem value="준비중">준비중</MenuItem>
                  <MenuItem value="출고대기">출고대기</MenuItem>
                  <MenuItem value="출고완료">출고완료</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: 150 }}>
                <InputLabel>판매처</InputLabel>
                <Select
                  value={sellerFilter}
                  label="판매처"
                  onChange={e => setSellerFilter(e.target.value)}
                >
                  <MenuItem value="all">전체 판매처</MenuItem>
                  {sellers.filter(s => s !== '전체').map(seller => (
                    <MenuItem key={seller} value={seller}>{seller}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Grid>

          <Grid item xs={12} md={12} lg={8}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>`;

const newGrid = `<Grid item xs={12}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
              <FormControl size="small" sx={{ width: 130 }}>
                <InputLabel>상태</InputLabel>
                <Select
                  value={statusFilter}
                  label="상태"
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">전체 상태</MenuItem>
                  <MenuItem value="준비중">준비중</MenuItem>
                  <MenuItem value="출고대기">출고대기</MenuItem>
                  <MenuItem value="출고완료">출고완료</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ width: 140 }}>
                <InputLabel>판매처</InputLabel>
                <Select
                  value={sellerFilter}
                  label="판매처"
                  onChange={e => setSellerFilter(e.target.value)}
                >
                  <MenuItem value="all">전체 판매처</MenuItem>
                  {sellers.filter(s => s !== '전체').map(seller => (
                    <MenuItem key={seller} value={seller}>{seller}</MenuItem>
                  ))}
                </Select>
              </FormControl>`;

content = content.replace(oldGrid, newGrid);

// remove the trailing </Box></Grid> for lg={8} block
const oldGridEnd = `              </LocalizationProvider>
            </Box>
          </Grid>

          <Grid item xs={12}>`;

const newGridEnd = `              </LocalizationProvider>
            </Box>
          </Grid>

          <Grid item xs={12}>`;
// Actually, I just merged the Box, so the trailing Box and Grid match perfectly with what's there. Just need to make sure we don't end up with an extra `</Grid>` or `</Box>`.
// Oh wait. I substituted TWO Grids with ONE Grid, but I kept the opening `<Grid item xs={12}>` and opened the flex Box. 
// So the single `</Box>\n</Grid>` at the bottom of the second old grid works perfectly for closing the single grid!

fs.writeFileSync(file, content);
console.log('Script ran successfully');
