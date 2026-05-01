const fs = require('fs');

let code = fs.readFileSync('src/components/Stats/SalesHistoryStats.jsx', 'utf8');

const targetStart = `<Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 4, mb: 2 }}>`;
const targetEnd = `</>
      )}
    </Box>
  );
}`;

const startIndex = code.indexOf(targetStart);
const endIndex = code.lastIndexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find targets");
  process.exit(1);
}

const replacement = `<Box sx={{ mt: 5, mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
              <AssessmentIcon sx={{ mr: 1, color: '#1565c0' }}/> 통합 매출 및 재고 보고서
            </Typography>
            
            <Grid container spacing={4}>
              {/* 왼쪽: 판매 매출 */}
              <Grid item xs={12} xl={6}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#424242' }}>
                  [1] 판매 현황 (총 판매 합계: {formatCurrency(totalAmt)})
                </Typography>
                <TableContainer component={Paper} sx={{ border: '1px solid #cfd8dc', borderRadius: 1, boxShadow: 'none' }}>
                  <Table size="small" sx={{ 
                    '& th, & td': { border: '1px solid #cfd8dc', padding: '8px 10px' },
                    '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem' },
                    '& td': { fontSize: '0.85rem' }
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width="15%">브랜드</TableCell>
                        <TableCell width="20%">매출 구분</TableCell>
                        <TableCell width="15%">세부 채널</TableCell>
                        <TableCell width="30%">상품명 (기종-색상 / 파츠)</TableCell>
                        <TableCell width="10%">수량</TableCell>
                        <TableCell width="10%">판매 금액</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comprehensiveSalesGroups.length === 0 ? (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>조회된 매출 데이터가 없습니다.</TableCell></TableRow>
                      ) : (
                        comprehensiveSalesGroups.map((b, bIdx) => {
                          const brandRowSpan = b.channelsArr.reduce((sum1, c) => 
                             sum1 + c.subChannelsArr.reduce((sum2, sc) => sum2 + sc.itemsArr.length, 0), 0);
                          
                          return b.channelsArr.map((c, cIdx) => {
                            const channelRowSpan = c.subChannelsArr.reduce((sum, sc) => sum + sc.itemsArr.length, 0);
                            
                            return c.subChannelsArr.map((sc, scIdx) => {
                              const subChannelRowSpan = sc.itemsArr.length;
                              
                              return sc.itemsArr.map((item, iIdx) => (
                                <TableRow key={\`\${bIdx}-\${cIdx}-\${scIdx}-\${iIdx}\`} hover>
                                  {cIdx === 0 && scIdx === 0 && iIdx === 0 && (
                                    <TableCell rowSpan={brandRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                      {b.brand}
                                    </TableCell>
                                  )}
                                  {scIdx === 0 && iIdx === 0 && (
                                    <TableCell rowSpan={channelRowSpan} align="center" sx={{ fontWeight: 'bold' }}>
                                      {c.channel}
                                    </TableCell>
                                  )}
                                  {iIdx === 0 && (
                                    <TableCell rowSpan={subChannelRowSpan} align="center">
                                      {sc.subChannel}
                                    </TableCell>
                                  )}
                                  <TableCell sx={{ color: item.isService ? '#ed6c02' : (!item.isAirframe ? '#607d8b' : 'inherit'), fontWeight: !item.isAirframe ? 'bold' : 'normal' }}>
                                    {item.name}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontWeight: !item.isAirframe || item.isService ? 'bold' : 'normal' }}>
                                    {item.quantity}{item.isService ? '건' : (item.isAirframe ? '대' : '개')}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                    {formatCurrency(item.amount)}
                                  </TableCell>
                                </TableRow>
                              ));
                            });
                          });
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* 오른쪽: 재고 현황 */}
              <Grid item xs={12} xl={6}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#424242' }}>
                  [2] 창고 종합 재고 현황
                </Typography>
                <TableContainer component={Paper} sx={{ border: '1px solid #cfd8dc', borderRadius: 1, boxShadow: 'none' }}>
                  <Table size="small" sx={{ 
                    '& th, & td': { border: '1px solid #cfd8dc', padding: '8px 10px' },
                    '& th': { bgcolor: '#eceff1', fontWeight: 'bold', textAlign: 'center', fontSize: '0.85rem' },
                    '& td': { fontSize: '0.85rem' }
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width="15%">창고</TableCell>
                        <TableCell width="15%">브랜드</TableCell>
                        <TableCell width="40%">품목 (기종-색상 / 파츠 종합)</TableCell>
                        <TableCell width="15%">재고 수량</TableCell>
                        <TableCell width="15%">재고 금액(도매가)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {comprehensiveInventoryGroups.length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>재고 데이터가 없습니다.</TableCell></TableRow>
                      ) : (
                        comprehensiveInventoryGroups.map((b, bIdx) => {
                          const brandRowSpan = b.itemsArr.length;
                          return b.itemsArr.map((item, iIdx) => (
                            <TableRow key={\`inv-\${bIdx}-\${iIdx}\`} hover>
                              {bIdx === 0 && iIdx === 0 && (
                                <TableCell 
                                  rowSpan={comprehensiveInventoryGroups.reduce((acc, br) => acc + br.itemsArr.length, 0)} 
                                  align="center" 
                                  sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}
                                >
                                  전체 (종합)
                                </TableCell>
                              )}
                              {iIdx === 0 && (
                                <TableCell rowSpan={brandRowSpan} align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
                                  {b.brand}
                                </TableCell>
                              )}
                              <TableCell sx={{ color: !item.isAirframe ? '#607d8b' : 'inherit', fontWeight: !item.isAirframe ? 'bold' : 'normal' }}>
                                {item.name}
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: !item.isAirframe ? 'bold' : 'normal' }}>
                                {item.quantity}{item.isAirframe ? '대' : '개'}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(item.amount)}
                              </TableCell>
                            </TableRow>
                          ));
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </Box>
        `;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);

fs.writeFileSync('src/components/Stats/SalesHistoryStats.jsx', code);
console.log('UI logic patched successfully.');
