import ExcelJS from 'exceljs';
import { parseDateHeaders, extractDateColumnValues } from './purchaseOrderExcelUtils';

describe('실제 xlsx 파일 왕복', () => {
  test('다운로드 형식 파일을 그대로 다시 읽어 파싱', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('발주현황');
    const d = '2026-11-13';
    ws.addRow(['Image', 'Brand', 'Model', 'Code', 'Barcode', 'Product Name', 'English Name', 'Remarks', 'Price (USD)',
      `${d} Order`, `${d} Received`, `${d} Status`, `${d} Memo`, `${d} Price (USD)`]);
    ws.addRow([null, 'XRB', 'X200', 'A-001', '8801', '테스트 상품', 'Test Product', '적요', 12.5, 10, 4, '부분입고(잔여 6)', '발주메모', 11.25]);

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await wb.xlsx.writeBuffer());
    const sheet = loaded.worksheets[0];

    const headerTexts = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, n) => { headerTexts[n] = String(cell.value ?? '').trim(); });
    const cols = parseDateHeaders(headerTexts);
    expect(cols).toHaveLength(1);

    const row = sheet.getRow(2);
    const values = extractDateColumnValues((n) => row.getCell(n).value, cols[0]);
    expect(values).toEqual({
      quantity: 10,
      received_quantity: 4,
      memo: '발주메모',
      price_usd: 11.25,
      isEmpty: false,
    });
  });
});

describe('parseDateHeaders', () => {
  test('날짜/라벨/필드 조합을 인식', () => {
    const headers = [];
    headers[1] = 'Code';
    headers[2] = '2026-11-13 Order';
    headers[3] = '2026-11-13 Received';
    headers[4] = '2026-11-13 Status';
    headers[5] = '2026-11-13 Memo';
    headers[6] = '2026-11-13 Price (USD)';
    const cols = parseDateHeaders(headers);
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatchObject({
      order_date: '2026-11-13',
      label: '',
      cols: { Order: 2, Received: 3, Status: 4, Memo: 5, 'Price (USD)': 6 },
    });
  });

  test('괄호 라벨을 label로 분리', () => {
    const headers = [];
    headers[1] = '2026-10-02 (10월 2차 발주) Order';
    headers[2] = '2026-10-02 (10월 2차 발주) Received';
    const cols = parseDateHeaders(headers);
    expect(cols).toHaveLength(1);
    expect(cols[0].label).toBe('10월 2차 발주');
    expect(cols[0].order_date).toBe('2026-10-02');
  });

  test('날짜가 다르면 별도 열로 분리', () => {
    const headers = [];
    headers[1] = '2026-11-13 Order';
    headers[2] = '2026-11-13 Received';
    headers[3] = '2026-11-01 Order';
    headers[4] = '2026-11-01 Received';
    expect(parseDateHeaders(headers)).toHaveLength(2);
  });

  test('날짜 형식이 아닌 헤더는 무시', () => {
    expect(parseDateHeaders([, 'Brand', 'Product Name', 'Code'])).toHaveLength(0);
  });
});

describe('extractDateColumnValues', () => {
  const headers = [];
  headers[2] = '2026-11-13 Order';
  headers[3] = '2026-11-13 Received';
  headers[4] = '2026-11-13 Status';
  headers[5] = '2026-11-13 Memo';
  headers[6] = '2026-11-13 Price (USD)';
  const [dc] = parseDateHeaders(headers);

  test('수량/입고/메모/USD를 헤더 위치 기준으로 읽음 (순서 무관)', () => {
    const cells = { 2: 10, 3: 4, 4: '부분입고(잔여 6)', 5: '메모입니다', 6: 12.5 };
    expect(extractDateColumnValues((n) => cells[n], dc)).toEqual({
      quantity: 10,
      received_quantity: 4,
      memo: '메모입니다',
      price_usd: 12.5,
      isEmpty: false,
    });
  });

  test('Status 칸이 없어도 메모/USD를 올바르게 읽음', () => {
    const h = [];
    h[1] = '2026-11-13 Order';
    h[2] = '2026-11-13 Received';
    h[3] = '2026-11-13 Memo';
    h[4] = '2026-11-13 Price (USD)';
    const [d] = parseDateHeaders(h);
    const cells = { 1: 5, 2: 5, 3: '완료', 4: '$9.90' };
    expect(extractDateColumnValues((n) => cells[n], d)).toEqual({
      quantity: 5,
      received_quantity: 5,
      memo: '완료',
      price_usd: 9.9,
      isEmpty: false,
    });
  });

  test('빈 행은 isEmpty', () => {
    expect(extractDateColumnValues(() => null, dc).isEmpty).toBe(true);
  });

  test('엑셀 수식/문자열 셀 객체도 처리', () => {
    const cells = { 2: { result: 3 }, 3: { text: '2' }, 5: { richText: [] }, 6: { result: 1.5 } };
    const out = extractDateColumnValues((n) => cells[n], dc);
    expect(out.quantity).toBe(3);
    expect(out.received_quantity).toBe(2);
    expect(out.price_usd).toBe(1.5);
  });
});
