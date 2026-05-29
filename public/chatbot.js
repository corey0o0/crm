(function () {
  'use strict';

  // ─── BRAND CONFIG ─────────────────────────────────────────────────────────
  // Cafe24 footer에서 <script>window.CHATBOT_BRAND='nb'</script> 로 지정
  const BRAND_KEY = (window.CHATBOT_BRAND || 'nb').toLowerCase();
  // 복수 인스턴스 위치 오프셋 (동시에 여러 브랜드 위젯을 띄울 때 사용)
  const _offsetRight  = window.CHATBOT_OFFSET_RIGHT  !== undefined ? window.CHATBOT_OFFSET_RIGHT  : 24;
  const _offsetBottom = window.CHATBOT_OFFSET_BOTTOM !== undefined ? window.CHATBOT_OFFSET_BOTTOM : 24;

  // ─── SHARED FAQs (브랜드 공통 정책 — 내용 동일) ──────────────────────────
  const SHARED_FAQS = [
    { keywords: ['배송', '도착', '언제', '며칠', '기간', '얼마나'],
      answer: '일반 배송은 평균 2~3 영업일 소요됩니다. 제주도 및 도서산간 지역은 추가 1~2일이 더 걸릴 수 있으며, 발송 후 문자로 운송장 번호를 안내해 드립니다.' },
    { keywords: ['반품', '환불', '취소'],
      answer: '수령 후 7일 이내 반품 신청이 가능합니다. 단순변심의 경우 왕복 배송비는 고객 부담이며, 불량·오배송의 경우 무료로 처리해 드립니다.' },
    { keywords: ['교환'],
      answer: '수령 후 7일 이내 교환 신청이 가능합니다. 고객센터(평일 09:00~18:00)로 먼저 연락 주시면 절차를 안내해 드립니다.' },
    { keywords: ['결제', '카드', '무통장', '카카오페이', '네이버페이'],
      answer: '신용카드, 무통장입금, 카카오페이, 네이버페이를 지원합니다. 무통장입금은 3일 이내 입금 확인이 필요합니다.' },
    { keywords: ['고객센터', '전화', '연락', '운영시간', '영업시간'],
      answer: '고객센터 운영시간은 평일 09:00~18:00입니다. 주말·공휴일은 휴무이며, 운영시간 외 문의는 홈페이지 1:1 문의를 이용해주세요.' },
    { keywords: ['체인', '이탈', '빠짐', '체인소리', '체인장력', '체인끊김'],
      answer: '체인 관련 안내:\n• 적정 체인 장력: 손으로 위아래 눌렀을 때 12~15mm 유동\n• 장력이 너무 강하면 바퀴 저항 증가, 너무 약하면 체인 이탈 위험\n• 체인 이탈이 자주 발생하면 가까운 대리점 또는 A/S 센터에서 점검 권장' },
    { keywords: ['교환불가', '환불불가', '반품불가', '개봉후', '1회사용', '단순변심'],
      answer: 'eBike(전기자전거)는 개봉 후 1회 사용 시점부터 교환·환불이 불가합니다.\n출고 즉시 주행 가능한 품목이므로 판매처 출고 후 1회 사용으로 간주됩니다.\n\n단, 보증 기간 내 기술상 결함 발생 시 해당 부품 무상 수리 또는 교체가 가능합니다.\n색상·옵션 변경 등 단순 변심은 교환·환불이 불가하니 구매 전 충분히 확인해주세요.' },
  ];

  const BRAND_CONFIG = {
    nb: {
      name: '니어바이크 고객센터',
      shopName: '니어바이크',
      shopUrl: 'www.nearbike.co.kr',
      color: '#1a73e8',
      avatar: '🚲',
      dbBrand: 'NB',
      mallId: 'nearbike',
      systemPrompt: `[역할]
당신은 니어바이크(www.nearbike.co.kr) 자전거 전문 쇼핑몰의 AI 고객센터 챗봇입니다.

[목표]
배송, 반품/교환, A/S, 결제 관련 일반 문의를 처리합니다.

[정보 출처 — 반드시 아래 정보만 사용]
- 취급 제품: 자전거, 자전거 부품, 자전거 용품, 라이딩 의류
- 고객센터: 평일 09:00~18:00 (주말/공휴일 휴무)
- 배송: 평균 2~3 영업일, 제주/도서산간 +2일
- 반품: 수령 후 7일 이내 / 단순변심 왕복배송비 고객부담 / 불량·오배송 무료
- 결제수단: 신용카드, 무통장입금, 카카오페이, 네이버페이

[안전·정책 규칙]
1. 위 정보에 없는 내용은 절대 추측하지 마세요.
2. 모르는 경우 고객센터(평일 09:00~18:00) 이관을 안내하세요.
3. 개인정보를 요청하거나 수집하지 마세요.
4. 고객이 불만·화남을 표현하면 공감 후 즉시 고객센터 연결을 안내하세요.

[출력 형식] 한국어, 친절하고 간결하게, 3문장 이내`,
      faqs: [
        ...SHARED_FAQS,
        // ── NB 전용 ──
        { keywords: ['AS', 'A/S', '수리', '고장', '파손'], answer: 'A/S 접수는 고객센터(평일 09:00~18:00)로 연락주시거나 A/S 현황 버튼으로 접수번호 조회가 가능합니다.' },
        { keywords: ['사이즈', '크기', '호환', '규격'], answer: '자전거 사이즈 및 부품 호환성은 제품마다 다를 수 있습니다. 모델명과 함께 고객센터로 문의주시면 상세히 안내해 드립니다.' },
        { keywords: ['재고', '품절', '입고'], answer: '재고 현황은 상품 페이지에서 실시간 확인이 가능합니다. 품절 상품 입고 일정은 고객센터로 문의해 주세요.' },
        // ── 모델 제원 ──
        { keywords: ['제원', '무게', '최고속도', '최대중량', '탑승중량', '몇kg', '몇 kg', '스펙'],
          answer: '니어바이크 모델별 제원:\n• 블레이드FS / 레트로FS / 클래식: 알루미늄, 최대탑승 120kg, 차체무게 30kg 미만\n• 레트로: 크로몰리강, 최대탑승 120kg, 차체무게 30kg 미만\n• 카고 / 카고LT: 알루미늄, 최대탑승 150kg, 차체무게 30kg 미만\n※ 전 모델 공통: 최고속도 25km/h 미만, PAS(페달어시스트) 전용' },
        // ── PAS 단계 ──
        { keywords: ['PAS', '파스', 'pas', '단계', '속도단계', '어시스트', '모터단계'],
          answer: 'PAS(페달어시스트) 단계별 최고속도:\n• 0단계: 모터 미작동 (일반 자전거)\n• 1단계: 10km/h\n• 2단계: 14km/h\n• 3단계: 18km/h\n• 4단계: 22km/h\n• 5단계: 24.5km/h\n평지 주행 시 3~4단계, 언덕 오를 때 1~2단계를 권장합니다.' },
        // ── 에러코드 ──
        { keywords: ['에러', '오류', '오류코드', 'E02', 'E06', 'E07', 'E08', 'E09', 'E14', 'E30', '에러코드'],
          answer: '디스플레이 오류코드 안내:\n• E02: 브레이크 오류 → 브레이크 레버 확인\n• E06: 저전압(배터리 부족) → 충전 필요\n• E07: 모터 동작 오류 → A/S 접수 필요\n• E08: 스로틀 오류 → 케이블 연결 확인\n• E09: 과전류 오류 → 전원 껐다 재시동 후 재확인\n• E14: 모터 홀센서 오류 → A/S 접수 필요\n• E30: 통신 오류 → 케이블 연결 확인\n오류가 계속되면 A/S 접수를 권장합니다.' },
        // ── 전원 문제 ──
        { keywords: ['전원', '안켜', '안켜짐', '작동안함', '켜지지않', '켜지지 않', '꺼짐', '전원불량'],
          answer: '전원이 켜지지 않을 때 확인 순서:\n① 배터리 인디케이터 버튼을 눌러 잔량 확인\n② 배터리가 완전 방전된 경우 충전 후 재시도\n③ 배터리 잠금장치가 완전히 잠겼는지 확인\n④ 키박스(일부 모델) 연결 상태 확인\n위 확인 후에도 해결되지 않으면 A/S 접수를 권장합니다.' },
        // ── 배터리 심화 ──
        { keywords: ['배터리충전', '충전방법', '충전시간', '충전완료', '충전램프', '충전불량', '충전안됨'],
          answer: '배터리 충전 안내:\n• 충전기 전원 연결 후 상태 표시등이 녹색인지 확인\n• 배터리 충전잭에 3핀 플러그 연결 → 적색(충전중) → 녹색(충전완료)\n• 충전 후 즉시 분리 권장\n• 최초 사용 시 반드시 100% 충전 후 사용\n• 운행 후 바로 충전 금지 — 30분~1시간 후 충전\n• 최소 2개월에 1회 이상 충전 (완전방전 시 A/S 불가)' },
        // ── 안장/시트포스트 ──
        { keywords: ['안장', '시트포스트', '안장높이', '안장조절', '안장규격', 'φ27'],
          answer: '안장 높이 조절 안내:\n• QR 래버 조절: 범위 약 10cm (래버 올리면 시트 위로)\n• 시트포스트 클램프 조절: 최대 약 14cm 추가 조절 가능\n• 시트포스트 규격: Φ27.2mm\n• ⚠️ 반드시 삽입한계선(MIN INSERT) 이하로 내려오지 않도록 주의 — 초과 시 프레임 파손 위험' },
        // ── 변속 ──
        { keywords: ['변속', '기어', '변속기', '기어안바뀜', '변속불량'],
          answer: '변속기 사용 안내:\n• 평지/내리막: 4~7단(고단) 권장\n• 언덕 오를 때: 1~3단(저단) 권장\n• 정차 중 변속 금지\n변속이 안 될 때:\n① 변속 와이어 장력이 느슨한지 확인\n② 변속기 와이어 조정볼트 조절\n③ 위 방법으로 해결 안 되면 A/S 센터 방문 권장' },
        // ── 보증기간 / 보증 부품 ──
        { keywords: ['보증', '보증기간', '무상수리', '무상AS', '무상A/S', '보증부품', '보증파츠', '워런티'],
          answer: '니어바이크 제품 보증 안내:\n\n[무상 보증 대상]\n• 프레임 / 모터 / 배터리\n• 보증 기간: 구매일로부터 1년, 누적 주행거리 3,000km 미만 (1회 한정)\n\n[유상 처리 소모품]\n브레이크, 타이어, 패드, 디스플레이, 컨트롤러, 유성기어, 라이트 등\n\n※ 보증 부품은 무상 제공이나 부품 교체 공임비는 별도 청구될 수 있습니다.\n※ 전국 가까운 대리점에서 A/S 가능합니다.' },
        // ── 보증 제외 항목 ──
        { keywords: ['보증제외', '보증안됨', '보증불가', '유상처리', '개조', '침수', '보증조건'],
          answer: '다음의 경우 보증기간 내에도 유상 처리됩니다:\n• 충돌·넘어짐·배터리 부주의 등 고객 취급 부주의\n• 산악주행·다운힐·계단 등 비정상 주행으로 인한 고장\n• 임의 개조 또는 타사 부품 사용\n• 무리한 언덕주행으로 인한 모터/컨트롤러/배터리 손상\n• 침수로 인한 고장\n• 니어바이크 정품 배터리 미사용\n• 최초 구매자가 아닌 경우\n\n⚠️ 배송 중 발생한 경미한 스크래치·도장누락·찍힘은 A/S 대상이 아닙니다.' },
        // ── 보험 ──
        { keywords: ['보험', '보험가입', '손해보험', '배상책임', '사고보험', '퍼스널모빌리티보험', '현대해상'],
          answer: '니어바이크 전용 보험 안내 (현대해상 퍼스널 모빌리티 상해보험):\n\n• 연간 보험료: 53,130원\n• 가입 조건: 만 16세~70세, 최고시속 25km/h 미만 제품 보유자\n\n[보장 내용]\n• 배상책임: 신체/재물 손해 최대 1,000만원\n• 형사사고비용: 변호사선임비 300만원 / 교통사고벌금 2,000만원\n• 상해 사망: 2,000만원 / 골절수술비: 200만원 / 입원일당: 2만원\n\n[제외 사항]\n불법개조, 배달·영업 등 직업용 사용, 경기·시범 중 사고\n\n• 가입 방법: 니어바이크 홈페이지 회원가입 후 보험료 입금\n• 문의: 법인보험씨에스 02-2266-4110' },
      ],
    },
    xrb: {
      name: 'X-RIDER 고객센터',
      shopName: 'X-RIDER',
      shopUrl: 'slimpack.co.kr',
      color: '#e53935',
      avatar: '⚡',
      dbBrand: 'XRB',
      mallId: 'slimpack79',
      systemPrompt: `[역할]
당신은 X-RIDER(slimpack.co.kr) 전동킥보드·전동자전거 전문 쇼핑몰의 AI 고객센터 챗봇입니다.

[목표]
배송, 반품/교환, A/S, 면허/법규, 배터리, 부품 호환성 등 일반 문의를 처리합니다.

[정보 출처 — 반드시 아래 정보만 사용]
- 쇼핑몰: slimpack.co.kr
- 취급 제품: 전동킥보드, 전동자전거, 개인형 이동장치(PM) 및 관련 부품/용품
- 고객센터: 평일 09:00~18:00 (주말/공휴일 휴무)
- 배송: 평균 2~3 영업일, 제주/도서산간 +2일
- 반품: 수령 후 7일 이내 / 단순변심 왕복배송비 고객부담 / 불량·오배송 무료
- 결제수단: 신용카드, 무통장입금, 카카오페이, 네이버페이
- 면허: 전동킥보드 운행 시 원동기면허(또는 이상) 필수, 헬멧 착용 의무
- 주행: 자전거도로 이용 가능(25km/h 이하), 인도·차도 주행 금지, 2인 탑승 금지
- 배터리: 충전 시간·주행거리는 제품별 상이, 완전 방전 상태 장기 보관 금지
- 부품: 정품 부품 권장, 타 브랜드 부품 호환 여부는 제품별 상이

[안전·정책 규칙]
1. 위 정보에 없는 내용은 절대 추측하지 마세요.
2. 법규 관련 최신 정보는 도로교통법 확인 또는 고객센터 이관을 안내하세요.
3. 개인정보를 요청하거나 수집하지 마세요.
4. 고객이 불만·화남을 표현하면 공감 후 즉시 고객센터 연결을 안내하세요.

[출력 형식] 한국어, 친절하고 간결하게, 3문장 이내`,
      faqs: [
        ...SHARED_FAQS,
        // ── XRB 전용 ──
        {
          keywords: ['AS', 'A/S', '수리', '고장', '파손'],
          answer: 'A/S 접수는 고객센터(평일 09:00~18:00)로 연락 주시거나, A/S 현황 버튼으로 접수번호 조회가 가능합니다. 보증기간 내 제조 하자는 무상 수리됩니다.',
        },
        // ── 면허 / 법규 ──
        {
          keywords: ['면허', '운전면허', '자격', '몇 살', '나이', '미성년'],
          answer: '전동킥보드 운행 시 원동기면허(125cc 이하) 이상 소지가 필수입니다. 만 16세 미만은 운행이 불가하며, 무면허 운행은 법적 처벌 대상입니다.',
        },
        {
          keywords: ['헬멧', '안전모', '의무', '착용'],
          answer: '전동킥보드 운행 시 안전모(헬멧) 착용은 법적 의무입니다. 미착용 시 범칙금이 부과될 수 있으니 반드시 착용해 주세요.',
        },
        {
          keywords: ['도로', '인도', '자전거도로', '주행', '어디', '어디서'],
          answer: '전동킥보드는 자전거도로(25km/h 이하)와 차도 우측 이용이 가능합니다. 보도(인도) 주행은 법적으로 금지되어 있으며, 2인 탑승도 불가합니다.',
        },
        {
          keywords: ['음주', '음주운전', '술'],
          answer: '전동킥보드 음주운전은 도로교통법상 금지되어 있으며, 적발 시 처벌 대상입니다. 안전한 이용 부탁드립니다.',
        },
        {
          keywords: ['보험', '사고', '배상', '책임'],
          answer: '전동킥보드 사고 시 일반 교통사고와 동일하게 처리됩니다. 별도 개인형 이동장치 보험 가입을 권장하며, 자세한 사항은 고객센터로 문의해 주세요.',
        },
        // ── 배터리 / 충전 ──
        {
          keywords: ['충전', '충전시간', '충전기', '완충'],
          answer: '충전 시간은 제품별로 다르며 보통 3~6시간 소요됩니다. 반드시 정품 충전기를 사용하시고, 완충 후 장시간 충전기 연결은 배터리 수명에 영향을 줄 수 있습니다.',
        },
        {
          keywords: ['배터리', '수명', '교체', '배터리교체', '방전'],
          answer: '배터리 수명은 사용 환경에 따라 다르며 보통 300~500회 충전 사이클을 기준으로 합니다. 완전 방전 상태로 장기 보관하면 배터리가 손상될 수 있으니 20~80% 수준을 유지해 보관해 주세요.',
        },
        {
          keywords: ['주행거리', '킬로미터', 'km', '거리', '얼마나 달려'],
          answer: '주행거리는 탑승자 체중, 경사도, 기온 등에 따라 실제와 차이가 날 수 있습니다. 제품별 공식 주행거리는 상품 상세 페이지에서 확인해 주세요.',
        },
        {
          keywords: ['겨울', '추위', '저온', '날씨', '온도'],
          answer: '리튬 배터리는 저온 환경(0°C 이하)에서 성능이 저하될 수 있습니다. 실내 보관 및 충전을 권장하며, 장기 미사용 시 20~50% 충전 상태로 서늘한 곳에 보관해 주세요.',
        },
        // ── 부품 호환성 ──
        {
          keywords: ['호환', '타 브랜드', '다른 브랜드', '부품', '규격'],
          answer: '부품 호환성은 제품 모델별로 다르게 적용됩니다. 정확한 호환 여부는 모델명과 함께 고객센터로 문의해 주시면 확인해 드립니다.',
        },
        {
          keywords: ['정품', '순정', '부품 구매', '부품 주문'],
          answer: '정품 부품은 slimpack.co.kr 또는 고객센터를 통해 구매 가능합니다. 비정품 부품 사용 시 A/S가 제한될 수 있으니 정품 사용을 권장합니다.',
        },
        {
          keywords: ['타이어', '튜브', '바퀴', '펑크'],
          answer: '타이어 및 튜브 교체는 모델별 규격이 다를 수 있습니다. 모델명과 함께 고객센터로 문의해 주시면 적합한 정품 부품을 안내해 드립니다.',
        },
        {
          keywords: ['업그레이드', '튜닝', '속도 올리기', '개조'],
          answer: '임의 개조 및 속도 제한 해제는 도로교통법 위반이며 안전사고 위험이 있습니다. 또한 제조사 보증이 무효화될 수 있으니 원상태 사용을 권장합니다.',
        },
        // ── 모델 제원 ──
        { keywords: ['제원', '무게', '최고속도', '최대중량', '탑승중량', '몇kg', '몇 kg', '스펙', '모델'],
          answer: 'X-RIDER 모델별 제원:\n• X200 MAX SL: 알루미늄, PAS+스로틀, 최대탑승 120kg, 무게 30kg 미만\n• X200 PRO SL: 알루미늄, PAS+스로틀, 최대탑승 140kg, 무게 30kg 미만\n• X200 GT: 알루미늄, PAS+스로틀, 최대탑승 140kg\n• X100 MAX SL: 알루미늄, PAS+스로틀, 최대탑승 140kg, 무게 30kg 미만\n• X50 FS: 알루미늄, PAS+스로틀, 최대탑승 120kg, 무게 30kg 미만\n※ 전 모델 공통: 최고속도 25km/h 미만' },
        // ── PAS/스로틀 ──
        { keywords: ['PAS', '파스', 'pas', '단계', '속도단계', '어시스트', '스로틀', '모터단계'],
          answer: 'X-RIDER PAS 단계별 최고속도:\n• 0단계: 모터 미작동\n• 1단계: 15km/h\n• 2단계: 20km/h\n• 3단계: 25km/h (최대)\n스로틀: 키박스 우측 스로틀을 돌리면 PAS 단계와 무관하게 모터 작동, 약 20초 유지 시 크루즈모드 진입\n※ 출발 시 PAS 1단계에서 페달을 천천히 밟아 출발 (급발진 예방)' },
        // ── 에러코드 ──
        { keywords: ['에러', '오류', '오류코드', 'E002', 'E006', 'E007', 'E008', 'E009', 'E010', 'E011', '에러코드'],
          answer: '디스플레이 오류코드 안내:\n• E002: 브레이크 동작 중 → 브레이크 레버 확인\n• E006: 저전압(배터리 부족) → 충전 필요\n• E007: 모터 동작 오류 → A/S 접수 필요\n• E008: 스로틀 오류 → 케이블 연결 확인\n• E009: 컨트롤러 오류 → 전원 껐다 재시동\n• E010: 디스플레이 통신 오류 → 케이블 연결 확인\n• E011: 컨트롤러 통신 오류 → A/S 접수 필요\n오류가 계속되면 A/S 접수를 권장합니다.' },
        // ── 전원 문제 ──
        { keywords: ['전원', '안켜', '안켜짐', '작동안함', '켜지지않', '켜지지 않', '꺼짐', '전원불량'],
          answer: '전원이 켜지지 않을 때 확인 순서:\n① 키박스에 키를 넣고 시계 방향으로 완전히 돌렸는지 확인\n② 배터리 버튼을 눌러 LED 잔량 확인\n③ 배터리 완전 방전 시 충전 후 재시도\n④ 배터리 잠금장치가 완전히 잠겼는지 확인\n위 확인 후에도 해결 안 되면 전체 케이블 연결 점검 후 A/S 접수를 권장합니다.' },
        // ── 배터리 심화 ──
        { keywords: ['배터리충전', '충전방법', '충전시간', '충전완료', '충전램프', '충전불량', '충전안됨'],
          answer: '배터리 충전 안내:\n• 충전기 전원 연결 → 표시등 녹색 확인\n• 배터리 충전잭에 3핀 플러그 연결 → 적색(충전중) → 녹색(충전완료)\n• 최초 사용 시 반드시 100% 충전 후 사용\n• 운행 후 바로 충전 금지 — 30분~1시간 후 충전\n• 최소 2개월에 1회 이상 충전 (완전방전 시 A/S 불가)\n• 배터리는 항상 자전거에서 분리 후 충전' },
        // ── 안장/시트포스트 ──
        { keywords: ['안장', '시트포스트', '안장높이', '안장조절', '안장규격', 'φ27'],
          answer: '안장 높이 조절 안내:\n• X50 FS 시트서스펜션: QR 래버로 약 10cm 조절\n• 시트포스트 클램프: 약 14cm 추가 조절 가능\n• 시트포스트 규격: Φ27.2mm\n• ⚠️ 반드시 삽입한계선(MIN INSERT) 이하로 내려오지 않도록 주의' },
        // ── 변속 ──
        { keywords: ['변속', '기어', '변속기', '기어안바뀜', '변속불량', '7단', '시마노'],
          answer: '변속기 사용 안내:\n• 전기자전거 모드 주행 시: 평지 4~7단, 언덕 1~3단 권장\n• 정차 중 변속 금지\n변속이 안 될 때:\n① 변속 와이어 장력이 느슨한지 확인 (7단에 놓고 와이어 조정볼트 반시계 방향 조절)\n② 위 방법으로 해결 안 되면 A/S 센터 방문 권장' },
        // ── 키박스/키 분실 ──
        { keywords: ['키', '열쇠', '키분실', '열쇠분실', '여분키', '키복사'],
          answer: '키박스 키는 동일 키 2개(고유키)만 제공되며 추가 제공이 어렵습니다. 분실 시 고객센터(평일 09:00~18:00)에 문의하여 처리 방법을 안내받으시기 바랍니다.' },
        // ── 보증기간 / 보증 부품 ──
        { keywords: ['보증', '보증기간', '무상수리', '무상AS', '무상A/S', '보증부품', '보증파츠', '워런티'],
          answer: 'X-RIDER 제품 보증 안내:\n\n[무상 보증 대상]\n• 프레임 / 모터 / 배터리\n• 보증 기간: 구매일로부터 1년, 누적 주행거리 3,000km 미만 (1회 한정)\n\n[유상 처리 소모품]\n브레이크, 타이어, 패드, 디스플레이, 컨트롤러, 유성기어, 라이트 등\n\n※ 보증 부품은 무상 제공이나 부품 교체 공임비는 별도 청구될 수 있습니다.\n※ 전국 가까운 대리점에서 A/S 가능합니다.' },
        // ── 보증 제외 항목 ──
        { keywords: ['보증제외', '보증안됨', '보증불가', '유상처리', '개조', '침수', '보증조건'],
          answer: '다음의 경우 보증기간 내에도 유상 처리됩니다:\n• 충돌·넘어짐·배터리 부주의 등 고객 취급 부주의\n• 산악주행·다운힐·계단 등 비정상 주행으로 인한 고장\n• 임의 개조 또는 타사 부품 사용\n• 무리한 언덕주행으로 인한 모터/컨트롤러/배터리 손상\n• 침수로 인한 고장\n• 엑스라이더 정품 배터리 미사용\n• 최초 구매자가 아닌 경우\n\n⚠️ 배송 중 발생한 경미한 스크래치·도장누락·찍힘은 A/S 대상이 아닙니다.' },
        // ── 보험 ──
        { keywords: ['보험', '보험가입', '손해보험', '배상책임', '사고보험', '퍼스널모빌리티보험', '현대해상'],
          answer: 'X-RIDER 전용 보험 안내 (현대해상 퍼스널 모빌리티 상해보험):\n\n• 연간 보험료: 53,130원\n• 가입 조건: 만 16세~70세, 최고시속 25km/h 미만 제품 보유자\n\n[보장 내용]\n• 배상책임: 신체/재물 손해 최대 1,000만원\n• 형사사고비용: 변호사선임비 300만원 / 교통사고벌금 2,000만원\n• 상해 사망: 2,000만원 / 골절수술비: 200만원 / 입원일당: 2만원\n\n[제외 사항]\n불법개조, 배달·영업 등 직업용 사용, 경기·시범 중 사고\n\n• 가입 방법: 엑스라이더 홈페이지 회원가입 후 보험료 입금\n• 문의: 법인보험씨에스 02-2266-4110' },
      ],
    },
  };

  const BRAND = BRAND_CONFIG[BRAND_KEY] || BRAND_CONFIG.nb;

  // ─── CONFIG ───────────────────────────────────────────────────────────────
  const _isLocal = window.location.hostname === 'localhost';
  const CONFIG = {
    faqThreshold: 1,
    // 로컬: Express(5001) + Ollama / 프로덕션: Netlify Functions + Claude
    apiUrl: _isLocal ? 'http://localhost:5001' : 'https://crmapp8893.netlify.app',
    useLlmProxy: !_isLocal,
    // 로컬 Ollama 설정
    ollamaModel: 'gemma4:e2b',
    ollamaUrl: 'http://localhost:11434/api/chat',
  };

  // 브랜드별 FAQ / 시스템 프롬프트 사용
  const FAQS = BRAND.faqs;
  const SYSTEM_PROMPT = BRAND.systemPrompt;

  const ESCALATION_SIGNALS = ['화나', '짜증', '환불해줘', '고소', '신고', '사기', '최악', '불량품', '소비자원', '항의'];
  const ORDER_INTENT = ['주문조회', '주문 조회', '주문번호', '배송조회', '배송 조회', '운송장'];
  const SERVICE_INTENT = ['as현황', 'a/s현황', 'as 현황', 'a/s 현황', '접수현황', '접수 현황', '수리현황', '접수번호', 'as접수', 'a/s접수'];

  // ─── CATEGORY CHIPS (초기 메뉴) ──────────────────────────────────────────
  const CATEGORY_CHIPS = [
    { label: '📦 주문·배송', value: '__cat_order__' },
    { label: '🔧 A/S·수리', value: '__cat_service__' },
    { label: '📖 제품·매뉴얼', value: '__cat_product__' },
    { label: '💬 기타 문의', value: '__cat_other__' },
  ];

  const SUB_CHIPS = {
    '__cat_order__': [
      { label: '📦 주문 조회', value: '주문 조회' },
      { label: '🚚 배송 문의', value: '배송 문의' },
      { label: '↩️ 반품/교환', value: '반품 교환 문의' },
    ],
    '__cat_service__': [
      { label: '🔧 A/S 현황', value: 'A/S 현황' },
      { label: '🛡 보증 안내', value: '보증기간 보증부품' },
      { label: '❗ 오류코드 안내', value: '오류코드 에러코드' },
    ],
    '__cat_product__': [
      { label: '📐 모델 제원', value: '모델 제원 스펙 무게 속도' },
      { label: '⚡ PAS 단계', value: 'PAS 단계 속도' },
      { label: '🔋 배터리·충전', value: '배터리 충전방법' },
    ],
    '__cat_other__': null,
  };

  // ─── STATUS CONFIG ────────────────────────────────────────────────────────
  const ORDER_STATUS_COLOR = {
    '결제완료': '#1a73e8',
    '배송준비': '#f59e0b',
    '배송중':   '#8b5cf6',
    '배송완료': '#10b981',
    '취소':     '#ef4444',
    '반품':     '#ef4444',
  };

  const SERVICE_STEPS = ['준비중', '부품준비', '준비완료', '출고완료'];
  const SERVICE_STATUS_COLOR = {
    '준비중':   '#1a73e8',
    '부품준비': '#f59e0b',
    '준비완료': '#10b981',
    '출고완료': '#6b7280',
    '취소':     '#ef4444',
  };

  // ─── LOGIC ────────────────────────────────────────────────────────────────
  function detectEscalation(msg) {
    return ESCALATION_SIGNALS.some((kw) => msg.includes(kw));
  }

  function detectOrderIntent(msg) {
    const n = msg.toLowerCase().replace(/\s/g, '');
    return ORDER_INTENT.some((kw) => n.includes(kw.toLowerCase().replace(/\s/g, '')));
  }

  function detectServiceIntent(msg) {
    const n = msg.toLowerCase().replace(/\s/g, '');
    return SERVICE_INTENT.some((kw) => n.includes(kw.toLowerCase().replace(/\s/g, '')));
  }

  function matchFaqs(msg, maxResults = 4) {
    const n = msg.toLowerCase().replace(/\s/g, '');
    const results = [];
    for (const faq of FAQS) {
      let score = 0;
      for (const kw of faq.keywords) if (n.includes(kw.toLowerCase())) score++;
      if (score >= CONFIG.faqThreshold) results.push({ faq, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults).map(r => r.faq);
  }

  function matchFaq(msg) {
    return matchFaqs(msg, 1)[0] || null;
  }

  async function callLlm(msg, history) {
    if (CONFIG.useLlmProxy) {
      // 프로덕션: Netlify Function → Claude Haiku
      const res = await fetch(`${CONFIG.apiUrl}/.netlify/functions/chatbot-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(-6), brand: BRAND_KEY }),
      });
      if (!res.ok) throw new Error('LLM 오류');
      const data = await res.json();
      return data.reply;
    } else {
      // 로컬 개발: Ollama
      const res = await fetch(CONFIG.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.ollamaModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history.slice(-6),
            { role: 'user', content: msg },
          ],
          stream: false,
        }),
      });
      if (!res.ok) throw new Error('Ollama error');
      const data = await res.json();
      return data.message?.content || '잠시 후 다시 시도해주세요.';
    }
  }

  async function lookupOrder(orderId, buyerName, phoneLast4) {
    const params = new URLSearchParams({
      order_id: orderId.trim(),
      buyer_name: buyerName.trim(),
      phone_last4: phoneLast4.trim(),
      mall_id: BRAND.mallId,
    });
    const base = CONFIG.useLlmProxy
      ? `${CONFIG.apiUrl}/.netlify/functions/chatbot-order`
      : `${CONFIG.apiUrl}/api/chatbot/order`;
    const res = await fetch(`${base}?${params}`);
    if (!res.ok) throw new Error('서버 오류');
    const data = await res.json();
    if (!data.found) return null;
    if (!data.verified) return 'wrong_info';
    return data.order;
  }

  async function lookupService(input) {
    const params = new URLSearchParams({ input: input.trim(), brand: BRAND.dbBrand });
    const base = CONFIG.useLlmProxy
      ? `${CONFIG.apiUrl}/.netlify/functions/chatbot-service`
      : `${CONFIG.apiUrl}/api/chatbot/service`;
    const res = await fetch(`${base}?${params}`);
    if (!res.ok) throw new Error('서버 오류');
    const data = await res.json();
    return data.found ? data.service : null;
  }

  async function registerService(name, phone, productName, symptom) {
    const base = CONFIG.useLlmProxy
      ? `${CONFIG.apiUrl}/.netlify/functions/chatbot-register-service`
      : `${CONFIG.apiUrl}/api/chatbot/register-service`;
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, product_name: productName, symptom, brand: BRAND_KEY }),
    });
    if (!res.ok) throw new Error('서버 오류');
    const data = await res.json();
    return data.service_id;
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif; }

    #toggle-btn {
      position: fixed; bottom: ${_offsetBottom}px; right: ${_offsetRight}px;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${BRAND.color}; border: none; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999; transition: transform 0.2s;
    }
    #toggle-btn:hover { transform: scale(1.08); }
    #toggle-btn svg { width: 28px; height: 28px; fill: white; }
    .unread-dot {
      position: absolute; top: 2px; right: 2px;
      width: 12px; height: 12px; border-radius: 50%;
      background: #ef4444; border: 2px solid white;
    }

    #chat-window {
      position: fixed; bottom: ${_offsetBottom + 66}px; right: ${_offsetRight}px;
      width: 380px; max-height: 600px;
      background: white; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: flex; flex-direction: column;
      z-index: 99998; overflow: hidden;
      transform-origin: bottom right;
      transition: transform 0.25s cubic-bezier(.4,0,.2,1), opacity 0.25s;
    }
    #chat-window.hidden { transform: scale(0.85); opacity: 0; pointer-events: none; }

    #chat-header {
      background: ${BRAND.color}; color: white;
      padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .hdr-name { font-weight: 700; font-size: 14px; }
    .hdr-status { font-size: 11px; opacity: 0.85; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
    .hdr-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }

    #messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      min-height: 0;
    }
    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }

    .msg { display: flex; flex-direction: column; max-width: 86%; }
    .msg.bot { align-self: flex-start; }
    .msg.user { align-self: flex-end; }

    .bubble {
      padding: 10px 14px; border-radius: 18px;
      font-size: 14px; line-height: 1.55;
    }
    .bot .bubble { background: #f1f3f4; color: #222; border-bottom-left-radius: 4px; }
    .user .bubble { background: ${BRAND.color}; color: white; border-bottom-right-radius: 4px; }

    .msg-meta { font-size: 11px; color: #aaa; margin-top: 4px; padding: 0 4px; display: flex; gap: 6px; align-items: center; }
    .msg.user .msg-meta { justify-content: flex-end; }

    .badge { padding: 1px 7px; border-radius: 8px; font-size: 10px; font-weight: 700; }
    .badge-faq     { background: #e8f0fe; color: #1a73e8; }
    .badge-ai      { background: #fce8ff; color: #8c00c7; }
    .badge-escalate{ background: #fff3e0; color: #e65100; }
    .badge-lookup  { background: #e6fff3; color: #059669; }

    /* 빠른 답변 버튼 */
    .quick-wrap { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 4px; margin-top: 4px; }
    .qchip {
      padding: 6px 12px; border-radius: 16px; font-size: 13px;
      background: #f1f3f4; color: #333; border: 1px solid #e0e0e0;
      cursor: pointer; white-space: nowrap; transition: all 0.15s;
      font-family: inherit;
    }
    .qchip:hover { background: #f0f4ff; border-color: ${BRAND.color}; color: ${BRAND.color}; }

    /* 정보 카드 */
    .card {
      background: white; border: 1px solid #e8eaf0;
      border-radius: 12px; overflow: hidden;
      font-size: 13px; min-width: 260px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .card-head {
      padding: 11px 14px;
      background: #f8f9ff;
      border-bottom: 1px solid #e8eaf0;
      display: flex; align-items: center; gap: 8px;
    }
    .card-icon { font-size: 16px; }
    .card-title { font-weight: 700; font-size: 13px; color: #222; flex: 1; }
    .card-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 7px; }
    .card-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .card-label { color: #888; font-size: 12px; flex-shrink: 0; padding-top: 1px; }
    .card-value { color: #222; font-size: 13px; font-weight: 500; text-align: right; }
    .card-divider { border: none; border-top: 1px solid #f0f0f0; margin: 4px 0; }
    .card-items { background: #fafafa; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
    .card-item-row { display: flex; justify-content: space-between; font-size: 12px; color: #444; }

    .status-badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 700; color: white;
    }

    /* A/S 진행 단계 */
    .steps { display: flex; align-items: center; padding: 10px 14px 12px; gap: 0; }
    .step { display: flex; flex-direction: column; align-items: center; flex: 1; }
    .step-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #ddd; border: 2px solid #ddd;
      transition: all 0.2s;
    }
    .step-dot.done { background: #1a73e8; border-color: #1a73e8; }
    .step-dot.current { background: white; border-color: ${BRAND.color}; box-shadow: 0 0 0 3px rgba(0,0,0,0.1); }
    .step-label { font-size: 10px; color: #aaa; margin-top: 4px; text-align: center; line-height: 1.2; }
    .step-label.active { color: #1a73e8; font-weight: 700; }
    .step-line { flex: 1; height: 2px; background: #ddd; margin-bottom: 14px; }
    .step-line.done { background: #1a73e8; }

    /* 입력 영역 */
    #input-area {
      padding: 10px 12px; border-top: 1px solid #eee;
      display: flex; gap: 8px; align-items: flex-end;
      flex-shrink: 0;
    }
    #user-input {
      flex: 1; border: 1px solid #ddd; border-radius: 20px;
      padding: 9px 14px; font-size: 14px; resize: none; outline: none;
      max-height: 96px; line-height: 1.45; font-family: inherit;
      background: #fafafa;
    }
    #user-input:focus { border-color: ${BRAND.color}; background: white; }
    #send-btn {
      width: 36px; height: 36px; border-radius: 50%;
      background: ${BRAND.color}; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.2s;
    }
    #send-btn:hover { filter: brightness(0.88); }
    #send-btn:disabled { background: #ccc; cursor: default; }
    #send-btn svg { width: 17px; height: 17px; fill: white; }

    .typing { display: flex; gap: 5px; padding: 12px 14px; background: #f1f3f4; border-radius: 18px; border-bottom-left-radius: 4px; width: fit-content; }
    .typing span { width: 7px; height: 7px; background: #bbb; border-radius: 50%; animation: bounce 1.2s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

    .hint { font-size: 12px; color: #aaa; padding: 2px 4px; }
  `;

  // ─── UI BUILDERS ──────────────────────────────────────────────────────────
  function nowTime() {
    return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }

  function statusBadge(label, color) {
    return `<span class="status-badge" style="background:${color || '#888'}">${label}</span>`;
  }

  function buildOrderCard(order) {
    const color = ORDER_STATUS_COLOR[order.status] || '#888';
    const itemsHtml = order.items.map(i =>
      `<div class="card-item-row"><span>${i.name} × ${i.qty}</span><span>${(i.price * i.qty).toLocaleString()}원</span></div>`
    ).join('');
    const trackingHtml = order.tracking_no
      ? `<div class="card-row"><span class="card-label">운송장</span><span class="card-value">${order.courier} ${order.tracking_no}</span></div>`
      : `<div class="card-row"><span class="card-label">배송</span><span class="card-value">아직 발송 전입니다</span></div>`;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <span class="card-icon">📦</span>
        <span class="card-title">주문 ${order.order_id}</span>
        ${statusBadge(order.status, color)}
      </div>
      <div class="card-body">
        <div class="card-row">
          <span class="card-label">주문일</span>
          <span class="card-value">${order.order_date}</span>
        </div>
        <hr class="card-divider">
        <div class="card-items">${itemsHtml}</div>
        <div class="card-row">
          <span class="card-label">결제금액</span>
          <span class="card-value" style="color:#1a73e8;font-weight:700">${order.total_amount.toLocaleString()}원</span>
        </div>
        <hr class="card-divider">
        ${trackingHtml}
      </div>
    `;
    return card;
  }

  function buildServiceCard(svc) {
    const currentStep = SERVICE_STEPS.indexOf(svc.status);
    const color = SERVICE_STATUS_COLOR[svc.status] || '#888';

    const stepsHtml = SERVICE_STEPS.map((step, i) => {
      const isDone = i < currentStep;
      const isCurrent = i === currentStep;
      const dotClass = isDone ? 'done' : isCurrent ? 'current' : '';
      const labelClass = isCurrent ? 'active' : '';
      const lineClass = i < SERVICE_STEPS.length - 1 ? (isDone || isCurrent ? 'done' : '') : '';
      const lineHtml = i < SERVICE_STEPS.length - 1 ? `<div class="step-line ${lineClass}"></div>` : '';
      return `
        <div class="step">
          <div class="step-dot ${dotClass}"></div>
          <div class="step-label ${labelClass}">${step.replace('완료', '\n완료')}</div>
        </div>
        ${lineHtml}
      `;
    }).join('');

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <span class="card-icon">🔧</span>
        <span class="card-title">A/S 접수번호 ${svc.id}</span>
        ${statusBadge(svc.status, color)}
      </div>
      <div class="steps">${stepsHtml}</div>
      <div class="card-body" style="padding-top:0">
        <div class="card-row">
          <span class="card-label">제품</span>
          <span class="card-value">${svc.product_name}</span>
        </div>
        <div class="card-row">
          <span class="card-label">증상</span>
          <span class="card-value">${svc.symptom}</span>
        </div>
        <hr class="card-divider">
        <div class="card-row">
          <span class="card-label">접수일</span>
          <span class="card-value">${svc.reception_date}</span>
        </div>
        <div class="card-row">
          <span class="card-label">예상완료</span>
          <span class="card-value">${svc.est_completion || '확인 중'}</span>
        </div>
      </div>
    `;
    return card;
  }

  // ─── INIT ─────────────────────────────────────────────────────────────────
  function init() {
    const host = document.createElement('div');
    host.id = `__chatbot_${BRAND_KEY}__`;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    // 토글 버튼
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-btn';
    toggleBtn.title = '고객센터 챗봇';
    toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg>`;
    shadow.appendChild(toggleBtn);

    // 채팅창
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chat-window';
    chatWindow.className = 'hidden';
    chatWindow.innerHTML = `
      <div id="chat-header">
        <div class="avatar">${BRAND.avatar}</div>
        <div>
          <div class="hdr-name">${BRAND.name}</div>
          <div class="hdr-status"><span class="hdr-dot"></span>AI 챗봇 · 24시간</div>
        </div>
      </div>
      <div id="messages"></div>
      <div id="input-area">
        <textarea id="user-input" placeholder="메시지를 입력하세요" rows="1"></textarea>
        <button id="send-btn"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </div>
    `;
    shadow.appendChild(chatWindow);

    const messagesEl = shadow.getElementById('messages');
    const inputEl    = shadow.getElementById('user-input');
    const sendBtnEl  = shadow.getElementById('send-btn');

    // 대화 상태
    let isOpen    = false;
    let isLoading = false;
    let history   = [];
    let convState = { step: 'IDLE', orderNo: null, buyerName: null, asName: null, asPhone: null, asProduct: null };

    // ── 메시지 추가 헬퍼 ──
    function addTextMsg(text, role, badgeClass, badgeLabel) {
      const div = document.createElement('div');
      div.className = `msg ${role}`;
      const badgeHtml = badgeClass
        ? `<span class="badge ${badgeClass}">${badgeLabel}</span>`
        : '';
      div.innerHTML = `
        <div class="bubble">${text.replace(/\n/g, '<br>')}</div>
        <div class="msg-meta">${badgeHtml}<span>${nowTime()}</span></div>
      `;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function addCardMsg(cardEl, badgeClass, badgeLabel) {
      const div = document.createElement('div');
      div.className = 'msg bot';
      const badgeHtml = badgeClass
        ? `<span class="badge ${badgeClass}">${badgeLabel}</span>`
        : '';
      div.appendChild(cardEl);
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.innerHTML = `${badgeHtml}<span>${nowTime()}</span>`;
      div.appendChild(meta);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addQuickReplies(replies) {
      const wrap = document.createElement('div');
      wrap.className = 'quick-wrap';
      replies.forEach(({ label, value }) => {
        const btn = document.createElement('button');
        btn.className = 'qchip';
        btn.textContent = label;
        btn.onclick = () => { wrap.remove(); processInput(value); };
        wrap.appendChild(btn);
      });
      messagesEl.appendChild(wrap);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addHint(text) {
      const div = document.createElement('div');
      div.className = 'msg bot';
      div.innerHTML = `<div class="hint">${text}</div>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping() {
      const div = document.createElement('div');
      div.className = 'msg bot';
      div.id = '__typing__';
      div.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function hideTyping() {
      shadow.getElementById('__typing__')?.remove();
    }

    // ── 메시지 처리 핵심 ──
    async function processInput(text) {
      if (!text || isLoading) return;
      isLoading = true;
      sendBtnEl.disabled = true;

      addTextMsg(text, 'user');
      showTyping();

      await new Promise((r) => setTimeout(r, 400));

      try {
        // 1. 카테고리 칩 선택
        if (text === '__restart__') {
          hideTyping();
          addTextMsg('무엇을 도와드릴까요? 😊', 'bot');
          addQuickReplies(CATEGORY_CHIPS);

        // 카테고리 칩 선택
        } else if (text.startsWith('__cat_')) {
          hideTyping();
          const subs = SUB_CHIPS[text];
          const catLabel = CATEGORY_CHIPS.find(c => c.value === text)?.label || '';
          if (subs) {
            addTextMsg(`${catLabel} 관련 문의입니다. 아래에서 선택해주세요. 😊`, 'bot');
            addQuickReplies(subs);
          } else {
            addTextMsg('궁금하신 내용을 자유롭게 입력해주세요. 담당 AI가 도와드리겠습니다. 😊', 'bot');
          }

        // FAQ 선택 칩
        } else if (text.startsWith('__faq_')) {
          const idx = parseInt(text.slice(6), 10);
          const faq = FAQS[idx];
          hideTyping();
          if (faq) {
            addTextMsg(faq.answer, 'bot', 'badge-faq', 'FAQ');
            addQuickReplies([
              { label: '📝 A/S 접수하기', value: '__as_register__' },
              { label: '🔧 A/S 현황 조회', value: 'A/S 현황' },
              { label: '🏠 처음으로', value: '__restart__' },
            ]);
          }

        // 2. 감정 신호 → 즉시 이관
        } else if (detectEscalation(text)) {
          hideTyping();
          addTextMsg('불편을 드려 정말 죄송합니다. 😔\n담당자가 직접 도와드리겠습니다. 고객센터(평일 09:00~18:00)로 연락주시면 신속하게 처리해 드립니다.', 'bot', 'badge-escalate', '상담원 연결');
          convState = { step: 'IDLE', orderNo: null, buyerName: null, asName: null, asPhone: null, asProduct: null };

        // 2. 주문 조회 — 주문번호 대기 중
        } else if (convState.step === 'ORDER_AWAIT_NO') {
          hideTyping();
          convState.orderNo = text.trim();
          convState.step = 'ORDER_AWAIT_NAME';
          addTextMsg('주문자 이름을 입력해주세요.', 'bot');
          addHint('예: 홍길동');

        // 3. 주문 조회 — 이름 대기 중
        } else if (convState.step === 'ORDER_AWAIT_NAME') {
          hideTyping();
          convState.buyerName = text.trim();
          convState.step = 'ORDER_AWAIT_PHONE';
          addTextMsg('주문 시 입력한 연락처 뒤 4자리를 입력해주세요.', 'bot');
          addHint('예: 5678');

        // 4. 주문 조회 — 이름 + 연락처 확인
        } else if (convState.step === 'ORDER_AWAIT_PHONE') {
          const savedOrderNo = convState.orderNo;
          const result = await lookupOrder(convState.orderNo, convState.buyerName, text);
          hideTyping();
          convState = { step: 'IDLE', orderNo: null, buyerName: null, asName: null, asPhone: null, asProduct: null };
          if (!result) {
            addTextMsg(`주문번호 "${savedOrderNo}"를 찾을 수 없습니다. 주문번호를 다시 확인해주세요.`, 'bot');
          } else if (result === 'wrong_info') {
            addTextMsg('입력하신 정보가 일치하지 않습니다. 이름과 연락처를 다시 확인해주세요.', 'bot');
          } else {
            addTextMsg('주문 정보를 확인했습니다. 📦', 'bot', 'badge-lookup', '주문 조회');
            addCardMsg(buildOrderCard(result), null, null);
            addQuickReplies([{ label: '↩️ 반품/교환 문의', value: '반품 교환 문의' }, { label: '💬 다른 문의', value: '안녕하세요' }]);
          }

        // 4. A/S 조회 — 접수번호 대기 중
        } else if (convState.step === 'SERVICE_AWAIT_ID') {
          const result = await lookupService(text);
          hideTyping();
          convState = { step: 'IDLE', orderNo: null, buyerName: null, asName: null, asPhone: null, asProduct: null };
          if (!result) {
            addTextMsg('A/S 접수 정보를 찾을 수 없습니다. 접수번호 또는 연락처를 다시 확인해주세요.\n고객센터(평일 09:00~18:00)에서도 확인 가능합니다.', 'bot');
          } else {
            addTextMsg('A/S 접수 현황을 확인했습니다. 🔧', 'bot', 'badge-lookup', 'A/S 조회');
            addCardMsg(buildServiceCard(result), null, null);
            addQuickReplies([{ label: '💬 추가 문의', value: '안녕하세요' }]);
          }

        // 5. A/S 신규 접수 플로우
        } else if (text === '__as_register__') {
          hideTyping();
          convState.step = 'AS_REG_NAME';
          addTextMsg('A/S 접수를 시작합니다. 📝\n성함을 입력해주세요.', 'bot');
          addHint('예: 홍길동');

        } else if (convState.step === 'AS_REG_NAME') {
          hideTyping();
          convState.asName = text.trim();
          convState.step = 'AS_REG_PHONE';
          addTextMsg('연락처를 입력해주세요.', 'bot');
          addHint('예: 010-1234-5678');

        } else if (convState.step === 'AS_REG_PHONE') {
          hideTyping();
          convState.asPhone = text.trim();
          convState.step = 'AS_REG_PRODUCT';
          addTextMsg('제품명(모델명)을 입력해주세요.', 'bot');
          addHint('예: X200 MAX SL / 블레이드FS');

        } else if (convState.step === 'AS_REG_PRODUCT') {
          hideTyping();
          convState.asProduct = text.trim();
          convState.step = 'AS_REG_SYMPTOM';
          addTextMsg('증상을 간단히 입력해주세요.', 'bot');
          addHint('예: 전원이 켜지지 않습니다 / E007 오류 발생');

        } else if (convState.step === 'AS_REG_SYMPTOM') {
          const { asName, asPhone, asProduct } = convState;
          convState = { step: 'IDLE', orderNo: null, buyerName: null, asName: null, asPhone: null, asProduct: null };
          const serviceId = await registerService(asName, asPhone, asProduct, text.trim());
          hideTyping();
          addTextMsg(
            `A/S 접수가 완료되었습니다. ✅\n\n접수번호: ${serviceId}\n성함: ${asName}\n제품: ${asProduct}\n\n담당자 확인 후 연락드리겠습니다.\n고객센터: 평일 09:00~18:00`,
            'bot', 'badge-lookup', 'A/S 접수'
          );
          addQuickReplies([
            { label: '🔧 A/S 현황 조회', value: 'A/S 현황' },
            { label: '🏠 처음으로', value: '__restart__' },
          ]);

        // 6. 주문 조회 의도 감지
        } else if (detectOrderIntent(text)) {
          hideTyping();
          convState.step = 'ORDER_AWAIT_NO';
          addTextMsg('주문 조회를 도와드리겠습니다. 📦\n카페24 주문번호를 입력해주세요.', 'bot');
          addHint('예: 20240501-000001');

        // 7. A/S 조회 의도 감지
        } else if (detectServiceIntent(text)) {
          hideTyping();
          convState.step = 'SERVICE_AWAIT_ID';
          addTextMsg('A/S 접수 현황을 확인해드리겠습니다. 🔧\nA/S 접수번호 또는 연락처를 입력해주세요.', 'bot');
          addHint('예: 1001 또는 010-1234-5678');

        // 8. FAQ 매칭
        } else {
          const faqs = matchFaqs(text);
          if (faqs.length === 1) {
            hideTyping();
            addTextMsg(faqs[0].answer, 'bot', 'badge-faq', 'FAQ');
            addQuickReplies([
              { label: '📝 A/S 접수하기', value: '__as_register__' },
              { label: '🔧 A/S 현황 조회', value: 'A/S 현황' },
              { label: '🏠 처음으로', value: '__restart__' },
            ]);
          } else if (faqs.length > 1) {
            hideTyping();
            addTextMsg('관련 항목을 찾았어요. 궁금한 내용을 선택해주세요. 😊', 'bot');
            addQuickReplies([
              ...faqs.map(faq => ({ label: faq.keywords[0], value: `__faq_${FAQS.indexOf(faq)}` })),
              { label: '🏠 처음으로', value: '__restart__' },
            ]);
          } else {
            // 9. LLM 폴백
            const reply = await callLlm(text, history);
            hideTyping();
            addTextMsg(reply, 'bot', 'badge-ai', 'AI');
            history.push({ role: 'user', content: text });
            history.push({ role: 'assistant', content: reply });
            addQuickReplies([
              { label: '📝 A/S 접수하기', value: '__as_register__' },
              { label: '🔧 A/S 현황 조회', value: 'A/S 현황' },
              { label: '🏠 처음으로', value: '__restart__' },
            ]);
          }
        }
      } catch {
        hideTyping();
        addTextMsg('죄송합니다, 잠시 후 다시 시도해주세요.\n고객센터: 평일 09:00~18:00', 'bot');
      }

      isLoading = false;
      sendBtnEl.disabled = false;
      inputEl.focus();
    }

    function send() {
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';
      inputEl.style.height = 'auto';
      processInput(text);
    }

    // ── 채팅창 열기/닫기 ──
    function openChat() {
      isOpen = true;
      chatWindow.classList.remove('hidden');
      if (toggleBtn.style.left) {
        applyWindowPos(parseFloat(toggleBtn.style.left), parseFloat(toggleBtn.style.top));
      }
      if (messagesEl.children.length === 0) {
        addTextMsg(`안녕하세요! ${BRAND.name}입니다. ${BRAND.avatar}\n무엇을 도와드릴까요?`, 'bot');
        addQuickReplies(CATEGORY_CHIPS);
      }
      inputEl.focus();
    }

    function closeChat() {
      isOpen = false;
      chatWindow.classList.add('hidden');
    }

    // ── 버튼 드래그 이동 ──
    const POS_KEY = `chatbot_pos_${BRAND_KEY}`;
    let isDragging = false;

    function applyBtnPos(left, top) {
      toggleBtn.style.right = '';
      toggleBtn.style.bottom = '';
      toggleBtn.style.left = left + 'px';
      toggleBtn.style.top  = top  + 'px';
    }

    function applyWindowPos(btnLeft, btnTop) {
      const W = 380, S = 56, gap = 10;
      let wLeft = btnLeft + S + gap;
      if (wLeft + W > window.innerWidth) wLeft = Math.max(0, btnLeft - W - gap);
      let wTop = Math.max(10, btnTop + S - (chatWindow.offsetHeight || 520));
      chatWindow.style.right  = '';
      chatWindow.style.bottom = '';
      chatWindow.style.left   = wLeft + 'px';
      chatWindow.style.top    = wTop  + 'px';
    }

    const savedPos = (() => { try { return JSON.parse(localStorage.getItem(POS_KEY)); } catch { return null; } })();
    if (savedPos) {
      applyBtnPos(savedPos.left, savedPos.top);
      applyWindowPos(savedPos.left, savedPos.top);
    }

    function startDrag(e) {
      const isTouch = e.type === 'touchstart';
      if (!isTouch) e.preventDefault();
      isDragging = false;
      const cx0 = isTouch ? e.touches[0].clientX : e.clientX;
      const cy0 = isTouch ? e.touches[0].clientY : e.clientY;
      const rect = toggleBtn.getBoundingClientRect();
      const l0 = rect.left, t0 = rect.top;
      applyBtnPos(l0, t0);

      function onMove(e) {
        const cx = isTouch ? e.touches[0].clientX : e.clientX;
        const cy = isTouch ? e.touches[0].clientY : e.clientY;
        const dx = cx - cx0, dy = cy - cy0;
        if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          isDragging = true;
          toggleBtn.style.transition = 'none';
          toggleBtn.style.transform = 'scale(1.08)';
        }
        if (!isDragging) return;
        const nl = Math.max(0, Math.min(window.innerWidth  - 56, l0 + dx));
        const nt = Math.max(0, Math.min(window.innerHeight - 56, t0 + dy));
        applyBtnPos(nl, nt);
        if (isOpen) applyWindowPos(nl, nt);
      }

      function onUp() {
        toggleBtn.style.transition = '';
        toggleBtn.style.transform  = '';
        document.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
        document.removeEventListener(isTouch ? 'touchend'  : 'mouseup',   onUp);
        if (isDragging) {
          const pos = { left: parseFloat(toggleBtn.style.left), top: parseFloat(toggleBtn.style.top) };
          try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
        }
      }

      document.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, isTouch ? { passive: true } : undefined);
      document.addEventListener(isTouch ? 'touchend'  : 'mouseup',   onUp);
    }

    toggleBtn.addEventListener('mousedown',  startDrag);
    toggleBtn.addEventListener('touchstart', startDrag, { passive: true });

    // ── 이벤트 바인딩 ──
    toggleBtn.addEventListener('click', () => {
      if (isDragging) { isDragging = false; return; }
      isOpen ? closeChat() : openChat();
    });
    sendBtnEl.addEventListener('click', send);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
