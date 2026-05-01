const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/OnlineStats.jsx', 'utf8');

// The B2B Table ends with:
//                     ) : (
//                       <TableRow><TableCell colSpan={5} align="center">데이터가 없습니다.</TableCell></TableRow>
//                     )}
//                   </TableBody>
//                 </Table>
//               </TableContainer>

// We need to calculate totals inside the component!
const calcTarget = `let filteredOrderCount = 0;
        const filteredList = [];`;
const calcReplace = `let filteredOrderCount = 0;
        const filteredList = [];
        
        let totalB2BAirframeQty = 0, totalB2BAirframeAmt = 0, totalB2BPartsQty = 0, totalB2BPartsAmt = 0;
        let totalB2CAirframeQty = 0, totalB2CAirframeAmt = 0, totalB2CPartsQty = 0, totalB2CPartsAmt = 0;`;
code = code.replace(calcTarget, calcReplace);

const addTotalsTarget = `if (isAirframe) {
                      let modelName = p.name || item.name || '알 수 없는 기체';`;
const addTotalsReplace = `if (customerType === 'agency') {
                    if (isAirframe) { totalB2BAirframeQty += qty; totalB2BAirframeAmt += amount; }
                    else { totalB2BPartsQty += qty; totalB2BPartsAmt += amount; }
                 } else {
                    if (isAirframe) { totalB2CAirframeQty += qty; totalB2CAirframeAmt += amount; }
                    else { totalB2CPartsQty += qty; totalB2CPartsAmt += amount; }
                 }
                 
                 if (isAirframe) {
                      let modelName = p.name || item.name || '알 수 없는 기체';`;
code = code.replace(addTotalsTarget, addTotalsReplace);

// add to states
const state2Target = `const [stats, setStats] = useState({ totalPayment: 0, orderCount: 0, list: [], agencyStats: {}, brandStats: {} });`;
const state2Replace = `const [stats, setStats] = useState({ totalPayment: 0, orderCount: 0, list: [], agencyStats: {}, brandStats: {}, totals: {} });`;
code = code.replace(state2Target, state2Replace);

// setStats
const setStatsTarget = `setStats({
          totalPayment: total,
          orderCount: filteredOrderCount,
          list: filteredList,
          agencyStats,
          brandStats,
          generalProductStats
        });`;
const setStatsReplace = `setStats({
          totalPayment: total,
          orderCount: filteredOrderCount,
          list: filteredList,
          agencyStats,
          brandStats,
          generalProductStats,
          totals: {
            b2b: { airframe: totalB2BAirframeQty, airframeAmt: totalB2BAirframeAmt, parts: totalB2BPartsQty, partsAmt: totalB2BPartsAmt },
            b2c: { airframe: totalB2CAirframeQty, airframeAmt: totalB2CAirframeAmt, parts: totalB2CPartsQty, partsAmt: totalB2CPartsAmt }
          }
        });`;
code = code.replace(setStatsTarget, setStatsReplace);

// Add B2B Footer
const b2bFooterTarget = `                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>브랜드별 제품 출고 현황 (일반고객 B2C)</Typography>`;
const b2bFooterReplace = `                    )}
                  </TableBody>
                  {Object.entries(stats.brandStats?.agency || {}).length > 0 && stats.totals?.b2b && (
                  <TableHead sx={{ bgcolor: 'grey.200' }}>
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>총합</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2b.airframeAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{stats.totals.b2b.parts}개 / {formatCurrency(stats.totals.b2b.partsAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2b.airframeAmt + stats.totals.b2b.partsAmt)}</TableCell>
                    </TableRow>
                  </TableHead>
                  )}
                </Table>
              </TableContainer>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>브랜드별 제품 출고 현황 (일반고객 B2C)</Typography>`;
code = code.replace(b2bFooterTarget, b2bFooterReplace);

// Add B2C Footer
const b2cFooterTarget = `                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>`;
const b2cFooterReplace = `                    )}
                  </TableBody>
                  {Object.entries(stats.brandStats?.general || {}).length > 0 && stats.totals?.b2c && (
                  <TableHead sx={{ bgcolor: 'grey.200' }}>
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>총합</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2c.airframeAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{stats.totals.b2c.parts}개 / {formatCurrency(stats.totals.b2c.partsAmt)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>{formatCurrency(stats.totals.b2c.airframeAmt + stats.totals.b2c.partsAmt)}</TableCell>
                    </TableRow>
                  </TableHead>
                  )}
                </Table>
              </TableContainer>
            </Grid>
          </Grid>`;
code = code.replace(b2cFooterTarget, b2cFooterReplace);

fs.writeFileSync('src/components/Stats/OnlineStats.jsx', code);
console.log('Patch Footer done.');
