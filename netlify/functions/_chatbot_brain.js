'use strict';
//
// 챗봇 공용 "두뇌" — 위젯(public/chatbot.js)의 대화 로직을 서버용으로 이식.
// 네이버 톡톡 등 비위젯 채널에서 위젯과 동일한 판단(정규화/인텐트/FAQ스코어/타이어/대리점)을 재사용.
// HTML 미지원 채널을 위해 출력은 평문 + URL.
//

const BRAND_META = {
  nb:  { name: '니어바이크', avatar: '🚲', dbBrand: 'NB',  mallId: 'nearbike'   },
  nb2: { name: '니어바이크', avatar: '🚲', dbBrand: 'NB',  mallId: 'nearbike'   },
  xrb: { name: 'X-RIDER',   avatar: '🛴', dbBrand: 'XRB', mallId: 'slimpack79' },
};

// ── 신호/인텐트 키워드 (위젯과 동일) ──
const ESCALATION_SIGNALS = ['화나', '짜증', '환불해줘', '고소', '신고', '사기', '최악', '불량품', '소비자원', '항의'];
const ORDER_INTENT   = ['주문조회', '주문 조회', '주문번호', '배송조회', '배송 조회', '운송장'];
const SERVICE_INTENT = ['as현황', 'a/s현황', 'as 현황', 'a/s 현황', '접수현황', '접수 현황', '수리현황', '접수번호', 'as접수', 'a/s접수'];
const TIRE_INTENT    = ['펑크', '타이어교체', '타이어 교체', '타이어구매', '튜브교체', '튜브 교체', '이너튜브', '타이어규격'];
const DEALER_INTENT  = ['대리점', '판매점', '판매처', '구매처', '가맹점', '어디서살', '어디서구매', '근처매장', '가까운매장', '오프라인'];
// EXACT 는 문장 전체가 그것일 때만 인사로 본다("하이브리드", "안녕히계세요" 오인식 방지)
const GREETING_EXACT = new Set(['hi', 'hello', '헬로', '하이', '안녕', 'ㅎㅇ', '처음']);
const GREETING_PREFIXES = ['안녕하', '반갑', '잘부탁', '처음이에', '처음입', '처음왔', '처음방문'];
const CANCEL_SIGNALS = ['취소', '그만', '중단', '돌아가', '처음으로', '메인으로', '안할게', '그만할게', '그냥둬', '됐어'];

const squash = (s) => String(s || '').toLowerCase().replace(/\s/g, '');

// 구어체·오타 정규화 (위젯 normalizeInput 이식)
function normalizeInput(text) {
  let n = squash(text);
  const fixes = [
    [/빳데리|밧데리|빠떼리|밧떼리|배때리|배떼리/g, '배터리'],
    [/파스모드|빠스모드/g, 'pas'],
    [/됫다가꺼|됐다가꺼|됐다꺼|됫다꺼|잠깐됐다가꺼|잠깐됐다꺼/g, '꺼짐'],
    [/꺼지고안켜|꺼졌다안켜/g, '꺼짐안켜'],
    [/기어안바껴|기어가안바껴/g, '기어안바뀜'],
    [/충전이안돼|충전안돼요|충전이안됩니다/g, '충전불량'],
    [/에러떠|오류뜨|코드뜨|숫자뜨/g, '에러코드'],
    [/언제와요|언제오나요|아직안왔어요/g, '배송언제'],
    [/환불해줘|환불원해요/g, '반품환불'],
    [/고장났어|고장났는데|고장이났어|망가졌어/g, '고장'],
  ];
  for (const [re, rep] of fixes) n = n.replace(re, rep);
  return n;
}

const detectEscalation = (msg) => ESCALATION_SIGNALS.some((kw) => msg.includes(kw));
const detectOrder   = (msg) => ORDER_INTENT.some((kw) => squash(msg).includes(squash(kw)));
const detectService = (msg) => SERVICE_INTENT.some((kw) => squash(msg).includes(squash(kw)));
const detectTire    = (msg) => TIRE_INTENT.some((kw) => squash(msg).includes(squash(kw)));
const detectDealer  = (msg) => DEALER_INTENT.some((kw) => squash(msg).includes(squash(kw)));
const isCancel      = (msg) => CANCEL_SIGNALS.some((kw) => squash(msg).includes(kw));
const isGreeting    = (msg) => {
  const normalized = squash(msg).replace(/[!?.,~]+$/g, '');
  return GREETING_EXACT.has(normalized)
    || GREETING_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

// ── 타이어/튜브 ──
const TIRE_INFO = {
  xrb: {
    models: [],
    default: { spec: '이너튜브 20×4.5~4.8', linkLabel: 'X-RIDER 공식 스토어',
      link: 'https://xrider.co.kr/product/%EC%9D%B4%EB%84%88%ED%8A%9C%EB%B8%8C-20x45-48-1%EA%B0%9C/6267/category/221/display/1/' },
  },
  nb: {
    models: [
      { names: ['레트로미니', '레트로 미니'], spec: '16"×4.0"', linkLabel: '레트로미니 튜브 구매',
        link: 'https://nearbike.co.kr/product/레트로-미니-튜브-16x40/55/category/33/display/1/' },
      { names: ['레트로fs', '레트로 fs', '레트로'], spec: '20"×4.0"', linkLabel: '레트로FS/레트로 튜브 구매',
        link: 'https://nearbike.co.kr/product/레트로fs레트로-튜브-20x40/161/category/52/display/1/' },
      { names: ['블레이드', '스프린터'], spec: '20"×2.4"', linkLabel: '블레이드/스프린터 튜브 구매',
        link: 'https://nearbike.co.kr/product/블레이드스프린터-튜브-20x24/130/category/55/display/1/' },
      { names: ['카고'], spec: '20"×3.0"', linkLabel: '카고 튜브 구매',
        link: 'https://nearbike.co.kr/product/카고-튜브-20x30/72/category/43/display/1/' },
      { names: ['클래식'], spec: '20"×2.125"', linkLabel: '클래식 튜브 구매',
        link: 'https://nearbike.co.kr/product/클래식-튜브-20x2125/33/category/32/display/1/' },
    ],
    default: { spec: null, linkLabel: '니어바이크 튜브 검색',
      link: 'https://nearbike.co.kr/product/search.html?banner_action=&keyword=%ED%8A%9C%EB%B8%8C' },
  },
};

function lookupTire(brand, model) {
  // nb2(공식홈) 도 NB 타이어 맵 공유
  const tireBrand = String(brand || '').toLowerCase() === 'xrb' ? 'xrb' : 'nb';
  const info = TIRE_INFO[tireBrand];
  if (!info) return null;
  const n = squash(model);
  for (const e of (info.models || [])) {
    if (e.names.some((nm) => n.includes(squash(nm)))) return e;
  }
  return info.default || null;
}
function buildTireAnswer(brand, model) {
  const info = lookupTire(brand, model);
  if (!info) return '해당 모델 정보를 찾을 수 없습니다. 모델명을 다시 알려주시거나 [A/S 접수]를 남겨주시면 담당자가 확인 후 안내해 드립니다.';
  const spec = info.spec ? `• 규격: ${info.spec}\n` : '';
  return `${model} 타이어(튜브) 안내 🔧\n\n${spec}• 구매: ${info.linkLabel}\n${info.link}\n\n정품 사용을 권장하며, 교체 시 대리점 또는 A/S 센터 방문을 추천드립니다.`;
}

// ── 대리점 ──
const DEALER_INFO = {
  nb:  { link: 'https://nearbike.co.kr/dealer/list.html',  linkLabel: '니어바이크 대리점 찾기', regions: '서울·인천·경기·충청·경상·전라·강원·제주' },
  xrb: { link: 'https://xrider.co.kr/shopinfo/dealer.html', linkLabel: 'X-RIDER 판매점 안내',   regions: '전국 판매점' },
};

const NB_DEALERS = {
  '서울': [
    { name: '서울전기자전거', phone: '010-7977-7732', address: '영등포구 당산로35길 4-13' },
    { name: '서울엑스브랜드직영점', phone: '010-7239-7007', address: '중랑구 용마산로 670' },
    { name: '강남점벨로휠전기자전거', phone: '0507-1386-3831', address: '관악구 신림로 86' },
    { name: '강변MTB', phone: '0507-1378-1818', address: '마포구 토정로 278' },
    { name: '일렉트로휠 방배점', phone: '02-777-1174', address: '서초구 방배중앙로27길 41' },
    { name: '글로리바이크153', phone: '0507-1380-7717', address: '노원구 동일로173가길 37' },
    { name: '으니전동놀이터', phone: '0507-1329-2970', address: '동대문구 제기로 100' },
    { name: '전동365', phone: '0507-1339-6310', address: '중랑구 용마산로 338' },
    { name: '엠스테이션', phone: '0507-1309-0695', address: '은평구 가좌로9길 16-8' },
    { name: '트윅스자전거', phone: '02-6013-1306', address: '용산구 보광로 68' },
    { name: '프라임바이크(은평)', phone: '010-2760-3407', address: '은평구 연서로41길 9' },
    { name: '전동포(송파)', phone: '010-3602-4781', address: '송파구 오금로31길 16-6' },
    { name: '퍼스널휠스', phone: '010-9820-0989', address: '강남구 삼성로63길 12' },
    { name: '109모빌리티(목동점)', phone: '0507-1380-1102', address: '양천구 은행정로 98' },
    { name: '에이벡(송파)', phone: '010-4913-3334', address: '송파구 올림픽로12길 28' },
    { name: '자전거 총각', phone: '010-9081-8581', address: '광진구 아차산로39길 24' },
    { name: '뉴바이크(NewBike)', phone: '02-915-4942', address: '성북구 화랑로 113' },
    { name: '에코바이크', phone: '010-4786-5385', address: '광진구 능동로4길 51' },
    { name: '109모빌리티(마포본점)', phone: '010-9765-9566', address: '마포구 월드컵로 164' },
    { name: '코디바이크(구로)', phone: '010-2674-5414', address: '구로구 개봉동 170-41' },
    { name: '강남청담점', phone: '010-8369-3476', address: '강남구 도산대로55길 18' },
  ],
  '인천': [
    { name: '모두모빌리티', phone: '010-4177-5120', address: '인천 서구 염곡로498번안길 33' },
    { name: '타이거바이크', phone: '010-5149-8245', address: '인천 남동구 선수천공원로17번길 8' },
    { name: '모토벨로 인천논현점', phone: '010-8917-1371', address: '인천 남동구 소래역남로16번길 8-31' },
    { name: '모토벨로 영종점', phone: '010-9366-9007', address: '인천 중구 하늘별빛로65번길 7-15' },
    { name: '코디바이크 송도점', phone: '010-9871-8389', address: '인천 연수구 해돋이로152번길 31' },
  ],
  '경기북부': [
    { name: '메리다알톤자전거 옥정점', phone: '031-894-5355', address: '양주시 옥정동로5나길 119' },
    { name: '핸디라이프 동두천점', phone: '010-8288-6929', address: '동두천시 삼육사로 949' },
    { name: '좋은생각 전기자전거', phone: '031-556-1013', address: '구리시 이문안로 115' },
    { name: '바이크디씨존', phone: '031-976-9222', address: '고양시 일산동구 성현로 46-23' },
    { name: '109모빌리티(김포점)', phone: '010-8422-1091', address: '김포시 김포한강4로212번길 12' },
    { name: '안녕자전거', phone: '0507-1490-9697', address: '김포시 김포한강8로 304' },
    { name: '프라임바이크(고양)', phone: '010-2760-3407', address: '고양시 덕양구 동산1로 50' },
    { name: '일렉트로휠(고양)', phone: '010-4716-0630', address: '고양시 덕양구 안진7길 13' },
    { name: '가나스포츠 덕정점', phone: '010-6644-1965', address: '양주시 독바위로 5' },
    { name: '109모빌리티(일산점)', phone: '010-8113-1091', address: '고양시 일산서구 대화동 2030-1' },
    { name: '자탄풍라운지', phone: '010-2614-3134', address: '의정부시 송현로82번길 69' },
    { name: '바이시클 스토리지(파주)', phone: '010-4277-3732', address: '파주시 운정로 78-30' },
    { name: '에이벡 남양주오남점', phone: '010-2324-2199', address: '남양주시 오남읍 경복대로17번안길 7-1' },
  ],
  '경기남부': [
    { name: '이프로 모빌리티', phone: '010-8013-9982', address: '광주시 양벌로 98' },
    { name: '핸디라이프 경기광주 본사', phone: '070-8095-4883', address: '광주시 경안천로 502-35' },
    { name: '핸디라이프 하남점', phone: '070-8095-4883', address: '하남시 신장로101' },
    { name: '핸디라이프 안양점', phone: '010-4371-4939', address: '안양시 동안구 갈산로2번길 5' },
    { name: '핸디라이프 시흥정왕점', phone: '010-4427-2826', address: '시흥시 봉우재로61번길 9' },
    { name: '통통통자전거', phone: '0507-1344-2905', address: '부천시 오정구 수도로47번길 12-18' },
    { name: '바이시클 스토리지 광명점', phone: '010-8932-3516', address: '광명시 일직로99번길 24' },
    { name: '킥플 평택점', phone: '010-8914-4504', address: '평택시 고덕면 효덕새싹길 98' },
    { name: '전동포 수원점', phone: '010-7448-4143', address: '수원시 장안구 정조로957번길 25-1' },
    { name: '킥플(수원)', phone: '010-8914-4504', address: '수원시 영통구 권선로882번길 115-1' },
    { name: '109모빌리티(안산점)', phone: '010-7504-5987', address: '안산시 단원구 적금로 55' },
    { name: '109모빌리티(안양점)', phone: '010-8592-1099', address: '안양시 만안구 안양로 190-1' },
    { name: '송산그린시티점', phone: '010-6712-5989', address: '화성시 수노을중앙로 293' },
    { name: '바이코레(고르고타고)', phone: '070-4600-2644', address: '화성시 양감면 은행나무로62번길 18-30' },
    { name: '두발이모빌리티', phone: '010-7550-6899', address: '부천시 은성로 117번길 13' },
    { name: '우산속자전거', phone: '010-5041-7787', address: '하남시 미사강변한강로 154' },
    { name: '사이클스팟', phone: '031-715-8340', address: '성남시 분당구 금곡로23번길 12' },
    { name: '바이크셀링', phone: '031-768-4482', address: '수원시 권선구 경수대로353' },
  ],
  '충청': [
    { name: '업힐노바이크', phone: '010-9284-0944', address: '대전 서구 용소로 40번길 47' },
    { name: '기브앤테이킥', phone: '041-533-3705', address: '충남 아산시 온천대로 1417' },
    { name: '핸디라이프 천안점', phone: '010-2737-0963', address: '천안시 서북구 서부16길 18' },
    { name: '이지모빌리티', phone: '010-2110-0284', address: '세종 시청대로 163' },
    { name: '몬바이크 대전점', phone: '042-585-0473', address: '대전 중구 대흥로 99' },
    { name: '몬바이크 세종점', phone: '010-7598-9260', address: '세종시 장군면 대교리 130-1' },
    { name: '모토벨로 내포신도시점', phone: '010-6419-1554', address: '충남 홍성군 홍북읍 애향5길 31' },
    { name: '유로휠 천안점', phone: '010-9523-1553', address: '천안시 서북구 미라3길 24' },
    { name: '유로휠 청주점', phone: '010-6324-0126', address: '청주시 흥덕구 봉명동 1410-1' },
  ],
  '경상': [
    { name: '비티에스(포항)', phone: '010-7548-7009', address: '경북 포항시 북구 삼흥로 86' },
    { name: '안동자전거', phone: '010-9370-3715', address: '경북 안동시 경동로 636' },
    { name: '전동핫플 해운대점', phone: '0507-1363-8390', address: '부산 해운대구 좌동로10번길 51-24' },
    { name: '전동개러지', phone: '0507-1312-6197', address: '대구 달서구 월배로 32' },
    { name: '전동핫플 사상점', phone: '0507-1330-4094', address: '부산 사상구 새벽시장로 70' },
    { name: '벨로벨로자전거가게', phone: '0507-1401-9641', address: '대구 동구 반야월로 205' },
    { name: '휠윈드 바이시클', phone: '0507-1406-9518', address: '대구 달서구 조암로 1' },
    { name: 'HJ모빌리티배터리', phone: '0507-1387-4881', address: '경남 거제시 장평3로3길 18' },
    { name: '무브컴퍼니', phone: '0507-1383-7719', address: '대구 동구 이노밸리로26길 12' },
    { name: '전동매니아', phone: '010-6638-4747', address: '경북 경산시 압량읍 화랑로63길 22-1' },
    { name: '전동샵', phone: '010-2551-4782', address: '대구 북구 산격로 87-1' },
    { name: '모노클', phone: '010-6541-1098', address: '대구 서구 팔달로18길 23' },
    { name: '전동포 구미점', phone: '010-6602-4480', address: '경북 구미시 3공단1로 263-26' },
    { name: '질주모빌리티', phone: '010-4718-4102', address: '부산 강서구 명지국제11로 74' },
    { name: '질주모빌리티 남구점', phone: '010-2725-7833', address: '부산 남구 수영로208번길 15' },
    { name: '질주모빌리티 동래점', phone: '010-3734-0014', address: '부산 동래구 아시아드대로247번길 9' },
    { name: '전동핫플 사하구점', phone: '010-7735-4258', address: '부산 사하구 하신번영로 376' },
    { name: '와이제이모터스', phone: '010-4862-0777', address: '대구 남구 성당로 104' },
    { name: '플레이모빌리티', phone: '010-2357-3599', address: '경남 진주시 진양호로 401' },
    { name: '알톤스포츠자전거', phone: '010-7310-7006', address: '경남 창원시 성산구 외동반림로 20' },
    { name: '전동핫플 금정점', phone: '0507-1318-4094', address: '부산 금정구 금강로 298' },
    { name: '알톤자전거 서부산 직영점', phone: '010-3598-4750', address: '부산 사상구 낙동대로 1230' },
    { name: '코지모빌리티', phone: '010-7608-6211', address: '울산 북구 진장로 8' },
  ],
  '전라': [
    { name: '위너바이크', phone: '010-8482-4852', address: '전북 남원시 역재3길 19' },
    { name: '광주전동차', phone: '010-5252-6460', address: '광주 서구 월드컵4강로 185' },
    { name: '핸디라이프 영암점', phone: '010-9198-6222', address: '전남 영암군 삼호읍 대불주거7로7길 5' },
    { name: '알톤자전거 익산신동점', phone: '010-7272-1506', address: '전북 익산시 인북로 311' },
    { name: '이지더휠 익산점', phone: '063-832-2083', address: '전북 익산시 동서로49길 24-1' },
    { name: '알톤자전거 진월대리점', phone: '010-4004-2077', address: '광주 남구 서문대로 628' },
    { name: '샘바이크', phone: '010-8690-2845', address: '광주 남구 금화로 436' },
    { name: '전동포(광주)', phone: '010-9922-9270', address: '광주 북구 비엔날레로 112-1' },
    { name: '모토벨로 백프로모빌리티', phone: '010-6441-0072', address: '전북 전주시 완산구 효자로 305' },
    { name: '승리모터스', phone: '010-9448-2471', address: '광주 서구 화개2로20번길9' },
  ],
  '강원·제주': [
    { name: '모빌리티 그라운드(춘천)', phone: '033-251-7755', address: '강원 춘천시 후석로 73' },
    { name: '트래빗 춘천공지천점', phone: '02-6466-5855', address: '강원 춘천시 수변공원길 9' },
    { name: '전동연구소(제주)', phone: '010-2783-2564', address: '제주시 귀아랑길 5' },
    { name: '바이크스테이션', phone: '033-813-0135', address: '강원 원주시 단구초교길 6-48' },
  ],
};

const dealerRegions = () => Object.keys(NB_DEALERS);
function buildDealerList(region) {
  const list = NB_DEALERS[region];
  if (!list || !list.length) return `${region} 지역 대리점 정보가 없습니다.`;
  const items = list.map((d, i) => `${i + 1}. ${d.name}\n   📞 ${d.phone}\n   📌 ${d.address}`).join('\n\n');
  return `🗺️ ${region} 대리점 (총 ${list.length}곳)\n\n${items}`;
}

// ── 지명으로 대리점 찾기 ────────────────────────────────────────────
// 고객이 "수원", "동탄" 처럼 동네 이름을 말해도 바로 안내하기 위한 색인.
// 주소에서 시/군/구 토큰을 뽑아 자동 생성하므로 대리점을 추가해도 따로 손댈 필요가 없다.
// 접미사를 뗀 형태("수원시"→"수원")도 넣어 고객이 어느 쪽으로 말해도 찾힌다.
const METRO = /^(서울|인천|부산|대구|광주|대전|울산|세종|강원|경기|충남|충북|전남|전북|경남|경북|제주)$/;

function buildPlaceIndex() {
  const idx = new Map();
  const add = (key, entry) => {
    if (!key || key.length < 2) return;
    if (!idx.has(key)) idx.set(key, []);
    const arr = idx.get(key);
    if (!arr.some((x) => x.name === entry.name)) arr.push(entry);
  };
  for (const region of Object.keys(NB_DEALERS)) {
    for (const d of NB_DEALERS[region]) {
      const entry = { ...d, region };
      for (const tok of String(d.address).split(/\s+/)) {
        if (/[시군구]$/.test(tok)) { add(tok, entry); add(tok.slice(0, -1), entry); }
        else if (METRO.test(tok)) add(tok, entry);
      }
    }
  }
  return idx;
}
const PLACE_INDEX = buildPlaceIndex();

// 대리점이 없는 지역 → 가까운 지역으로 안내하기 위한 표.
// near 값은 위 색인에 실제로 존재하는 지명이어야 하고, 같은 이름이 여러 광역에
// 있을 때(서구·강서구 등)는 region 으로 좁힌다. 새 지명은 여기 한 줄만 추가하면 된다.
const PLACE_ALIASES = {
  '동탄': { near: ['화성시'] },
  '판교': { near: ['분당구'] },
  '광교': { near: ['수원시'] },
  '용인': { near: ['수원시', '분당구'] },
  '과천': { near: ['안양시', '광명시'] },
  '오산': { near: ['화성시', '수원시'] },
  '이천': { near: ['광주시'], region: '경기남부' },
  '여주': { near: ['광주시'], region: '경기남부' },
  '포천': { near: ['의정부시', '양주시'] },
  '송도': { near: ['연수구'], region: '인천' },
  '청라': { near: ['서구'], region: '인천' },
  '강릉': { near: ['원주시', '춘천시'] },
  '제천': { near: ['청주시'] },
  '군산': { near: ['익산시', '전주시'] },
  '목포': { near: ['영암군'] },
  '순천': { near: ['광주'], region: '전라' },
  '여수': { near: ['광주'], region: '전라' },
  '김해': { near: ['강서구', '사상구'], region: '경상' },
  '양산': { near: ['금정구', '동래구'], region: '경상' },
  '통영': { near: ['거제시'] },
};

const MAX_DEALER_RESULTS = 5;

// 입력에서 지명을 찾아 대리점을 반환. none=true 면 그 지역엔 대리점이 없어 근처를 대신 안내하는 경우.
function findDealersByPlace(text) {
  const t = String(text || '');
  // 긴 이름부터 확인해 "수원시"가 "수원"보다 우선하도록 한다
  for (const key of [...PLACE_INDEX.keys()].sort((a, b) => b.length - a.length)) {
    if (t.includes(key)) return { place: key, dealers: PLACE_INDEX.get(key), none: false };
  }
  for (const [place, cfg] of Object.entries(PLACE_ALIASES)) {
    if (!t.includes(place)) continue;
    const dealers = [];
    for (const n of cfg.near) {
      for (const d of (PLACE_INDEX.get(n) || [])) {
        if (cfg.region && d.region !== cfg.region) continue;
        if (!dealers.some((x) => x.name === d.name)) dealers.push(d);
      }
    }
    if (dealers.length) return { place, dealers, none: true };
  }
  return null;
}

// 지명이 안 잡히면 null — 호출부에서 기존 지역 선택 화면으로 넘긴다.
function buildNearbyDealerAnswer(text) {
  const found = findDealersByPlace(text);
  if (!found) return null;
  const shown = found.dealers.slice(0, MAX_DEALER_RESULTS);
  const items = shown.map((d, i) => `${i + 1}. ${d.name}\n   📞 ${d.phone}\n   📌 ${d.address}`).join('\n\n');
  const more = found.dealers.length > shown.length
    ? `\n\n그 외 ${found.dealers.length - shown.length}곳이 더 있어요. 지역을 알려주시면 안내해 드릴게요.` : '';
  const head = found.none
    ? `${found.place}에는 대리점이 없습니다. 가까운 지역 대리점을 안내드릴게요 🗺️`
    : `${found.place} 지역 대리점입니다 🗺️`;
  return `${head}\n\n${items}${more}`;
}

// ── FAQ 스코어링 (DB faq_items 행: {label, keywords, answer}) ──
// keywords가 배열/JSON문자열/콤마문자열 어느 형태로 와도 안전하게 처리(배포 환경 차이 방어)
function kwList(raw) {
  if (Array.isArray(raw)) return raw;
  const s = String(raw || '').trim();
  if (s.startsWith('[')) { try { const a = JSON.parse(s); if (Array.isArray(a)) return a; } catch {} }
  return s.split(',');
}
function matchFaqs(faqRows, msg, threshold = 1, maxResults = 4) {
  const n = normalizeInput(msg);
  const scored = [];
  for (const f of (faqRows || [])) {
    const kws = kwList(f.keywords).map((k) => squash(k)).filter(Boolean);
    let score = 0;
    for (const kw of kws) if (n.includes(kw)) score++;
    if (score >= threshold) scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((r) => r.f);
}

module.exports = {
  BRAND_META,
  normalizeInput, squash,
  detectEscalation, detectOrder, detectService, detectTire, detectDealer, isCancel, isGreeting,
  TIRE_INFO, lookupTire, buildTireAnswer,
  DEALER_INFO, NB_DEALERS, dealerRegions, buildDealerList,
  PLACE_ALIASES, findDealersByPlace, buildNearbyDealerAnswer,
  matchFaqs,
};
