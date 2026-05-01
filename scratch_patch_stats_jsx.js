const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/OnlineStats.jsx', 'utf8');

// 1. Add Mall Filter UI
const brandFilterTarget = `{/* 브랜드 선택 */}
          <ButtonGroup size="large" variant="outlined" sx={{ height: 40 }}>`;
const brandFilterReplace = `{/* 사이트 필터 */}
          <FormControl size="small" sx={{ minWidth: 140, height: 40 }}>
            <InputLabel>사이트별 조회</InputLabel>
            <Select
              value={selectedMall}
              label="사이트별 조회"
              onChange={(e) => handleMallSelect(e.target.value)}
              sx={{ height: 40 }}
            >
              <MenuItem value="all">전체 사이트</MenuItem>
              {malls.map(m => (
                <MenuItem key={m.mall_id} value={m.mall_id}>{m.mall_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* 브랜드 선택 */}
          <ButtonGroup size="large" variant="outlined" sx={{ height: 40 }}>`;
code = code.replace(brandFilterTarget, brandFilterReplace);

// 2. Add clickable to 대리점별 매출
const agencyClickTarget = `<TableCell>{agencyName}</TableCell>`;
const agencyClickReplace = `<TableCell 
                              onClick={() => handleOpenModal(\`\${agencyName} 판매 상세 내역\`, (o, agName) => agName === agencyName)}
                              sx={{ cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                            >{agencyName}</TableCell>`;
code = code.replace(agencyClickTarget, agencyClickReplace);

// 3. Add clickable to B2B 브랜드
const b2bBrandClickTarget = `<TableCell sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2 }}>{brandName}</TableCell>`;
const b2bBrandClickReplace = `<TableCell 
                              onClick={() => handleOpenModal(\`대리점(B2B) - \${brandName} 판매 상세 내역\`, (o, agName, item, isAirframe, brand) => o.agency_id && brand === brandName)}
                              sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2, cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                            >{brandName}</TableCell>`;
code = code.replace(b2bBrandClickTarget, b2bBrandClickReplace);

// 4. Add clickable to B2C 브랜드
const b2cBrandClickTarget = `<TableCell sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2 }}>{brandName}</TableCell>`;
const b2cBrandClickReplace = `<TableCell 
                              onClick={() => handleOpenModal(\`일반고객(B2C) - \${brandName} 판매 상세 내역\`, (o, agName, item, isAirframe, brand) => !o.agency_id && brand === brandName)}
                              sx={{ fontWeight: 'bold', verticalAlign: 'top', pt: 2, cursor: 'pointer', color: 'primary.main', textDecoration: 'underline' }}
                            >{brandName}</TableCell>`;
code = code.replace(b2cBrandClickTarget, b2cBrandClickReplace);

// 5. Add Modal at the end of the file
const endTarget = `</Container>
  );
}`;
const endReplace = `
      {/* 상세내역 모달 */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>{modalTitle}</DialogTitle>
        <DialogContent dividers>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell>주문일</TableCell>
                  <TableCell>주문번호</TableCell>
                  <TableCell>상품명</TableCell>
                  <TableCell align="right">수량</TableCell>
                  <TableCell align="right">결제금액</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modalData.length > 0 ? modalData.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.order_date ? row.order_date.split('T')[0] : ''}</TableCell>
                    <TableCell>{row.order_id}</TableCell>
                    <TableCell>{row.name || row.product_name}</TableCell>
                    <TableCell align="right">{row.quantity}개</TableCell>
                    <TableCell align="right">{formatCurrency(row.total_price)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} align="center">판매 내역이 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} variant="contained" sx={{ bgcolor: 'grey.800', '&:hover': { bgcolor: 'grey.900' } }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}`;
code = code.replace(endTarget, endReplace);

fs.writeFileSync('src/components/Stats/OnlineStats.jsx', code);
console.log('Patch JSX done.');
