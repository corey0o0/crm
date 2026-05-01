const fs = require('fs');
let code = fs.readFileSync('src/components/Stats/OnlineStats.jsx', 'utf8');

// Add imports
code = code.replace("  Stack\n} from '@mui/material';", "  Stack,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,\n  Select,\n  MenuItem,\n  FormControl,\n  InputLabel\n} from '@mui/material';\nimport { getCafe24Malls } from '../../utils/cafe24Api';");

// Add state & useEffect
const stateTarget = `const [selectedBrand, setSelectedBrand] = useState('전체');`;
const stateReplace = `const [selectedBrand, setSelectedBrand] = useState('전체');
  const [malls, setMalls] = useState([]);
  const [selectedMall, setSelectedMall] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);
  const [rawOrders, setRawOrders] = useState([]);
  const [agencyMapGlobal, setAgencyMapGlobal] = useState({});

  useEffect(() => {
    const fetchMalls = async () => {
      try {
        const res = await getCafe24Malls();
        if (res.success && res.malls) {
          setMalls(res.malls.filter(m => m.connected));
        }
      } catch (err) {}
    };
    fetchMalls();
  }, []);`;
code = code.replace(stateTarget, stateReplace);

// Update title
code = code.replace('온라인 주문 통계 (Cafe24)', '온라인 매출통계');

// Handlers
const handlerTarget = `// 브랜드 선택 핸들러`;
const handlerReplace = `// 쇼핑몰 선택 핸들러
  const handleMallSelect = (mallId) => {
    setSelectedMall(mallId);
    fetchData(startDate, endDate, selectedBrand, mallId);
  };

  const handleOpenModal = (title, dataFilter) => {
    setModalTitle(title);
    const items = [];
    rawOrders.forEach(o => {
      const agName = o.agency_id ? (agencyMapGlobal[o.agency_id] || '미등록 대리점') : '일반 주문';
      o.order_items?.forEach(item => {
        const pCode = String(item.custom_product_code || item.product_code || '').trim();
        const pName = item.name || item.product_name || '';
        const isAirframe = pName.includes('기체') || pName.includes('차체');
        const brand = (pCode.toUpperCase().startsWith('NB') || pName.includes('니어')) ? 'NB' : 'XRB'; // simplified brand check

        if (dataFilter(o, agName, item, isAirframe, brand)) {
           items.push({
             ...item,
             order_id: o.order_id,
             order_date: o.order_date,
             buyer_name: o.buyer_name,
             agency_name: agName,
             total_price: Number(item.quantity || 1) * Number(item.product_price || item.price || 0)
           });
        }
      });
    });
    setModalData(items);
    setModalOpen(true);
  };

  // 브랜드 선택 핸들러`;
code = code.replace(handlerTarget, handlerReplace);

// fetchData
const fetchTarget = `const fetchData = async (qStart, qEnd, qBrand = selectedBrand) => {
    setLoading(true);
    try {
      const startDateTime = formatDateToStartOfDay(qStart || startDate);
      const endDateTime = formatDateToEndOfDay(qEnd || endDate);

      const yearStart = formatDateToStartOfDay(startOfYear(qStart || startDate));
      const yearEnd = formatDateToEndOfDay(endOfYear(qStart || startDate));

      const [
        { data: cafe24Orders, error },
        { data: agenciesData },
        { data: partsData },
        { data: chartDataRaw }
      ] = await Promise.all([
        supabase.from('cafe24_orders').select('*').gte('order_date', startDateTime).lte('order_date', endDateTime).eq('is_deleted', false).eq('is_transferred', true),
        supabase.from('agencies').select('id, name'),
        supabase.from('parts').select('id, code, barcode, brand, note, price, name'),
        supabase.from('cafe24_orders').select('order_date, total_amount').gte('order_date', yearStart).lte('order_date', yearEnd).eq('is_deleted', false).eq('is_transferred', true)
      ]);`;
const fetchReplace = `const fetchData = async (qStart, qEnd, qBrand = selectedBrand, qMall = selectedMall) => {
    setLoading(true);
    try {
      const startDateTime = formatDateToStartOfDay(qStart || startDate);
      const endDateTime = formatDateToEndOfDay(qEnd || endDate);

      const yearStart = formatDateToStartOfDay(startOfYear(qStart || startDate));
      const yearEnd = formatDateToEndOfDay(endOfYear(qStart || startDate));

      let orderQuery = supabase.from('cafe24_orders').select('*').gte('order_date', startDateTime).lte('order_date', endDateTime).eq('is_deleted', false).eq('is_transferred', true);
      let chartQuery = supabase.from('cafe24_orders').select('order_date, total_amount').gte('order_date', yearStart).lte('order_date', yearEnd).eq('is_deleted', false).eq('is_transferred', true);
      
      if (qMall !== 'all') {
        orderQuery = orderQuery.eq('mall_id', qMall);
        chartQuery = chartQuery.eq('mall_id', qMall);
      }

      const [
        { data: cafe24Orders, error },
        { data: agenciesData },
        { data: partsData },
        { data: chartDataRaw }
      ] = await Promise.all([
        orderQuery,
        supabase.from('agencies').select('id, name'),
        supabase.from('parts').select('id, code, barcode, brand, note, price, name'),
        chartQuery
      ]);`;
code = code.replace(fetchTarget, fetchReplace);

// Set map
const setMapTarget = `const agencyMap = {};
        agenciesData?.forEach(a => { agencyMap[a.id] = a.name; });`;
const setMapReplace = `const agencyMap = {};
        agenciesData?.forEach(a => { agencyMap[a.id] = a.name; });
        setAgencyMapGlobal(agencyMap);
        setRawOrders(cafe24Orders);`;
code = code.replace(setMapTarget, setMapReplace);

fs.writeFileSync('src/components/Stats/OnlineStats.jsx', code);
console.log('Patch 1 done.');
