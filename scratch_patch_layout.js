const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/pages/sales/ManualSalesList.jsx');
let content = fs.readFileSync(file, 'utf8');

const rightSideFilterOld = `<Grid item xs={12} md={7} lg={8}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} useFlexGap flexWrap="wrap">
              <FormControl size="small" sx={{ width: { xs: '100%', sm: 130 } }}>
                <InputLabel>날짜 유형</InputLabel>
                <Select
                  value={dateFilter.type}
                  label="날짜 유형"
                  onChange={(e) => handleDateFilterChange('type', e.target.value)}
                >
                  <MenuItem value="order_date">주문일자</MenuItem>
                  <MenuItem value="shipment_date">출고일자</MenuItem>
                </Select>
              </FormControl>

              <ButtonGroup size="small" variant="outlined">
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('yesterday')}>어제</Button>
                <Button onClick={() => handleQuickDateFilter('thisWeek')}>이번주</Button>
                <Button onClick={() => handleQuickDateFilter('lastWeek')}>지난주</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
              </ButtonGroup>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatePicker
                    value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                    onChange={(newValue) => handleDateFilterChange('startDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 140 } } }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                    onChange={(newValue) => handleDateFilterChange('endDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 140 } } }}
                  />
                </Box>
              </LocalizationProvider>
            </Stack>
          </Grid>`;

const rightSideFilterNew = `<Grid item xs={12} md={12} lg={8}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>날짜 유형</InputLabel>
                <Select
                  value={dateFilter.type}
                  label="날짜 유형"
                  onChange={(e) => handleDateFilterChange('type', e.target.value)}
                >
                  <MenuItem value="order_date">주문일자</MenuItem>
                  <MenuItem value="shipment_date">출고일자</MenuItem>
                </Select>
              </FormControl>

              <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap' }}>
                <Button onClick={() => handleQuickDateFilter('today')}>오늘</Button>
                <Button onClick={() => handleQuickDateFilter('yesterday')}>어제</Button>
                <Button onClick={() => handleQuickDateFilter('thisWeek')}>이번주</Button>
                <Button onClick={() => handleQuickDateFilter('lastWeek')}>지난주</Button>
                <Button onClick={() => handleQuickDateFilter('thisMonth')}>이번달</Button>
                <Button onClick={() => handleQuickDateFilter('lastMonth')}>지난달</Button>
              </ButtonGroup>

              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <DatePicker
                    value={dateFilter.startDate ? parseISO(dateFilter.startDate) : null}
                    onChange={(newValue) => handleDateFilterChange('startDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 130 } } }}
                  />
                  <Typography variant="body2">~</Typography>
                  <DatePicker
                    value={dateFilter.endDate ? parseISO(dateFilter.endDate) : null}
                    onChange={(newValue) => handleDateFilterChange('endDate', newValue ? format(newValue, 'yyyy-MM-dd') : '')}
                    slotProps={{ textField: { size: "small", sx: { width: 130 } } }}
                  />
                </Box>
              </LocalizationProvider>
            </Box>
          </Grid>`;

// Replace left side grid md={5} with md={12} lg={4} to ensure it doesn't wrap weirdly when right side drops
const leftSideFilterOld = `<Grid item xs={12} md={5} lg={4}>
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">`;
            
const leftSideFilterNew = `<Grid item xs={12} md={12} lg={4}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>`;

const leftSideStackEndOld = `              </FormControl>
            </Stack>
          </Grid>`;

const leftSideStackEndNew = `              </FormControl>
            </Box>
          </Grid>`;

content = content.replace(rightSideFilterOld, rightSideFilterNew);
content = content.replace(leftSideFilterOld, leftSideFilterNew);
content = content.replace(leftSideStackEndOld, leftSideStackEndNew);

fs.writeFileSync(file, content);
console.log('Script ran successfully');
