const B2C_CHANNELS = ['공홈', '청담매장', '라이클', '라이클-우리', '스마트할부', '스마트스토어', '기타', '온라인주문', '고객', '-', '본사/기본', '과거 이카운트 이관', '일반출고(공홈)', '매장출고', '본점', '매장'];

const rows = [
  { sales_channel: '공홈' },
  { sales_channel: '기타' },
  { sales_channel: '고객' },
  { sales_channel: '매장' },
  { sales_channel: '대리점A' }
];

const filtered = rows.filter(r => {
  const isB2C = !r.sales_channel || B2C_CHANNELS.includes(r.sales_channel);
  if (!isB2C) return false;
  return true;
});

console.log(filtered);
