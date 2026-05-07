const fs = require('fs');
const path = '/Users/weird/Desktop/Work/AS/crm-app/src/pages/shipment/ShipmentList.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. 상태 제거
content = content.replace(/const \[firstPageLoaded, setFirstPageLoaded\] = useState\(false\);\n/, '');
content = content.replace(/const \[loadedChunks, setLoadedChunks\] = useState\(0\);\n/, '');
content = content.replace(/const \[isLoadingNextChunk, setIsLoadingNextChunk\] = useState\(false\);\n/, '');
content = content.replace(/const \[hasMoreData, setHasMoreData\] = useState\(true\);\n/, '');
content = content.replace(/const \[backgroundLoading\] = useState\(false\);\n/, '');
content = content.replace(/const \[loadProgress\] = useState\(0\);\n/, '');

// 2. fetchFirstPage 와 fetchNextChunk 제거 및 fetchShipments 재작성
const fetchLogicStart = content.indexOf('  // 첫 페이지만 빠르게 로딩하는 함수');
const fetchLogicEnd = content.indexOf('  // 검색이나 필터 변경 시에만 페이지 초기화');

const newFetchLogic = `
  const fetchShipments = async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setNetworkError(false);
      setHasActiveSearch(false);

      let processedDateFilter = {};
      if (dateFilter.startDate && dateFilter.endDate) {
        processedDateFilter = {
          startDate: format(new Date(dateFilter.startDate), 'yyyy-MM-dd') + 'T00:00:00+09:00',
          endDate: format(new Date(dateFilter.endDate), 'yyyy-MM-dd') + 'T23:59:59+09:00',
          type: dateFilter.type
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const [totalCount, pageData] = await Promise.all([
        countShipments({
          selectedBrand,
          searchTerm,
          dateFilter: processedDateFilter,
          statusFilter,
          sellerFilter,
          recordType: 'store_shipment',
          signal: controller.signal
        }),
        fetchShipmentsAPI({
          selectedBrand,
          searchTerm,
          dateFilter: processedDateFilter,
          statusFilter,
          sellerFilter,
          recordType: 'store_shipment',
          page: page,
          pageSize: rowsPerPage,
          signal: controller.signal
        })
      ]);

      clearTimeout(timeoutId);

      setTotalExpected(totalCount || 0);
      setShipments(pageData || []);

      // 판매처 목록 수집 (현재 페이지 + 기본 항목)
      const uniqueSellers = new Set(['전체', '공홈']);
      if (pageData) {
        pageData.forEach(shipment => {
          uniqueSellers.add(extractSalesChannel(shipment.note, shipment.sales_channel));
        });
      }
      setSellers(Array.from(uniqueSellers));

      setRetryCount(0);
      setLoading(false);

    } catch (err) {
      console.error('[ShipmentList] Error fetching page:', err);
      setNetworkError(true);
      if (err?.name === 'AbortError') {
        setSnackbar({ open: true, severity: 'error', message: '요청이 시간 초과로 취소되었습니다.' });
        setLoading(false);
        return;
      }

      const msg = String(err?.message || '');
      if (retryAttempt === 0 && (msg.includes('Failed to fetch') || msg.includes('NetworkError'))) {
        return fetchShipments(1);
      }

      setSnackbar({ open: true, message: '네트워크 연결 문제가 발생했습니다.', severity: 'error' });
      setLoading(false);
    }
  };

`;

content = content.substring(0, fetchLogicStart) + newFetchLogic + content.substring(fetchLogicEnd);

// 3. filteredShipments 수정
const filteredShipmentsStart = content.indexOf('  // filteredShipments useMemo로 계산');
const filteredShipmentsEnd = content.indexOf('  // 기존 함수명 유지를 위한 래퍼') !== -1 ? content.indexOf('  // 기존 함수명 유지를 위한 래퍼') : content.indexOf('  // useEffect');
const newFilteredShipments = `
  // 서버사이드 필터링 및 페이지네이션 도입으로 클라이언트 필터 제거
  const filteredShipments = shipments;

`;

// 4. useEffect 감시
// Replace the complex useEffect that handles page scrolling and fetching next chunk with simple ones.
content = content.replace(/  useEffect\(\(\) => \{\n    if \(firstPageLoaded && hasMoreData && !isLoadingNextChunk.*?\n  \}, \[loading, isLoadingNextChunk, hasMoreData, hasActiveSearch, filteredShipments\.length, page, rowsPerPage, shipments\.length\]\);\n/, '');

// Change the main data loading useEffect
content = content.replace(/  useEffect\(\(\) => \{\n    fetchShipments\(\);\n  \}, \[selectedBrand, searchTrigger\]\);/g, `
  useEffect(() => {
    fetchShipments();
  }, [selectedBrand, searchTrigger, page, rowsPerPage, statusFilter, sellerFilter]);
`);

// 5. 페이지네이션 렌더링 추가
// Find where table renders and add pagination.
// In ShipmentList, we need to add TablePagination or Pagination.
content = content.replace(/              \{filteredShipments\.map\(\(shipment\) => \(\n/g, `
              {filteredShipments.map((shipment) => (
`);

fs.writeFileSync(path, content, 'utf8');
console.log('ShipmentList.jsx refactored.');
