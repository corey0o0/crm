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
    { label: '배송', keywords: ['배송', '도착', '언제', '며칠', '기간', '얼마나',
        '언제와요', '언제오나요', '아직안왔', '배송조회', '배송현황', '택배', '운송장', '몇일걸려', '오늘오나', '내일오나', '배송됐나'],
      answer: '일반 배송은 평균 2~3 영업일 소요됩니다. 제주도 및 도서산간 지역은 추가 1~2일이 더 걸릴 수 있으며, 발송 후 문자로 운송장 번호를 안내해 드립니다.' },
    { label: '반품환불', keywords: ['반품', '환불', '취소',
        '환불하고싶', '반품하고싶', '돌려받', '돌려보내', '반품신청', '환불신청', '취소하고싶', '마음바꿨', '되돌려'],
      answer: '수령 후 7일 이내 반품 신청이 가능합니다. 단순변심의 경우 왕복 배송비는 고객 부담이며, 불량·오배송의 경우 무료로 처리해 드립니다.' },
    { label: '교환', keywords: ['교환', '교환신청', '바꾸고싶', '다른걸로', '교환하고싶'],
      answer: '수령 후 7일 이내 교환 신청이 가능합니다. A/S 접수를 남겨주시면 담당자가 확인 후 절차를 안내해 드립니다.' },
    { label: '결제수단', keywords: ['결제', '카드', '무통장', '카카오페이', '네이버페이',
        '결제방법', '계좌번호', '입금', '결제수단', '어떻게결제', '입금확인'],
      answer: '신용카드, 무통장입금, 카카오페이, 네이버페이를 지원합니다. 무통장입금은 3일 이내 입금 확인이 필요합니다.' },
    { label: '고객센터', keywords: ['고객센터', '전화', '연락', '운영시간', '영업시간',
        '문의', '상담', '담당자', '주말에', '공휴일', '몇시까지', '쉬는날', '전화번호'],
      answer: '저희는 챗봇으로 상담을 도와드리고 있어요. 궁금하신 점을 입력해 주시면 바로 안내해 드리고, 해결이 어려운 경우 A/S 접수를 도와드립니다. 운영시간은 평일 09:00~18:00이며 별도 전화 상담은 운영하지 않습니다.' },
    { label: '체인', keywords: ['체인', '이탈', '빠짐', '체인소리', '체인장력', '체인끊김',
        '체인빠져', '체인빠졌', '체인이빠져', '페달헛도는', '체인빠짐'],
      answer: '체인 관련 안내:\n• 적정 체인 장력: 손으로 위아래 눌렀을 때 12~15mm 유동\n• 장력이 너무 강하면 바퀴 저항 증가, 너무 약하면 체인 이탈 위험\n• 체인 이탈이 자주 발생하면 가까운 대리점 또는 A/S 센터에서 점검 권장' },
    { label: '교환불가', keywords: ['교환불가', '환불불가', '반품불가', '개봉후', '1회사용', '단순변심',
        '이미탔는데', '탔는데환불', '사용했는데', '개봉했는데'],
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
- 취급 제품: 전기자전거(PAS 전동), 부품, 용품, 라이딩 의류
- 운영시간: 평일 09:00~18:00 (주말/공휴일 휴무)
- 배송: 평균 2~3 영업일, 제주/도서산간 +2일
- 반품: 수령 후 7일 이내 / 단순변심 왕복배송비 고객부담 / 불량·오배송 무료
- 결제수단: 신용카드, 무통장입금, 카카오페이, 네이버페이

[고객센터·전화 정책]
- 이 챗봇이 곧 고객센터입니다. 전화 상담은 운영하지 않습니다.
- 전화번호·"전화로 연락"·"고객센터로 전화" 같은 통화 안내를 절대 하지 마세요.

[안전·정책 규칙]
1. 위 정보에 없는 내용은 절대 추측하지 마세요.
2. 챗봇으로 해결이 어렵거나 직접 처리가 필요하면 전화가 아니라 "A/S 접수"를 남기도록 안내하세요.
3. 개인정보를 요청하거나 수집하지 마세요.
4. 고객이 불만·화남을 표현하면 공감 후 "A/S 접수"를 남기도록 안내하세요.

[출력 형식] 한국어, 친절하고 간결하게, 3문장 이내`,
      faqs: [
        ...SHARED_FAQS,
        // ── NB 전용 ──
        { label: 'A/S접수', keywords: ['AS', 'A/S', '수리', '고장', '파손',
            '고장났', '망가졌', '부서졌', '이상해요', '이상한데', '작동이상', '작동안해', '뭔가이상', '수리맡기', 'as신청', '수리받고싶', 'a/s신청'],
          answer: 'A/S 접수는 챗봇의 A/S 접수 버튼으로 바로 남기실 수 있습니다.' },
        { label: '사이즈호환', keywords: ['사이즈', '크기', '호환', '규격'], answer: '자전거 사이즈 및 부품 호환성은 제품마다 다를 수 있습니다. 모델명을 알려주시면 상세히 안내해 드리고, 추가 확인이 필요하면 A/S 접수를 도와드립니다.' },
        { label: '재고품절', keywords: ['재고', '품절', '입고'], answer: '재고 현황은 상품 페이지에서 실시간 확인이 가능합니다. 품절 상품 입고 일정은 채팅으로 문의하시거나 A/S 접수를 남겨주시면 안내해 드립니다.' },
        // ── 모델 제원 ──
        { label: '모델제원', keywords: ['제원', '무게', '최고속도', '최대중량', '탑승중량', '몇kg', '몇 kg', '스펙',
            '가볍나요', '무겁나요', '몇키로까지', '속도얼마나', '최대속도', '몇킬로', '탑승가능', '몇키로'],
          answer: '니어바이크 모델별 제원:\n• 블레이드FS / 레트로FS / 클래식: 알루미늄, 최대탑승 120kg, 차체무게 30kg 미만\n• 레트로: 크로몰리강, 최대탑승 120kg, 차체무게 30kg 미만\n• 카고 / 카고LT: 알루미늄, 최대탑승 150kg, 차체무게 30kg 미만\n※ 전 모델 공통: 최고속도 25km/h 미만, PAS(페달어시스트) 전용' },
        // ── PAS 단계 ──
        { label: 'PAS단계', keywords: ['PAS', '파스', 'pas', '단계', '속도단계', '어시스트', '모터단계',
            '파스모드', '전동모드', '배터리없이', '1단계', '2단계', '3단계', '4단계', '5단계', '몇단', '단수조절'],
          answer: 'PAS(페달어시스트) 단계별 최고속도:\n• 0단계: 모터 미작동 (일반 자전거)\n• 1단계: 10km/h\n• 2단계: 14km/h\n• 3단계: 18km/h\n• 4단계: 22km/h\n• 5단계: 24.5km/h\n평지 주행 시 3~4단계, 언덕 오를 때 1~2단계를 권장합니다.' },
        // ── 에러코드 ──
        { label: '에러코드', keywords: ['에러', '오류', '오류코드', 'E02', 'E06', 'E07', 'E08', 'E09', 'E14', 'E30', '에러코드',
            'E6', 'E7', 'E8', 'E9', '에러번호', '코드뜨', '화면에숫자', '에러떠', '오류떠', '숫자뜨', '화면에코드'],
          answer: '디스플레이 오류코드 안내:\n• E02: 브레이크 오류 → 브레이크 레버 확인\n• E06: 저전압(배터리 부족) → 충전 필요\n• E07: 모터 동작 오류 → A/S 접수 필요\n• E08: 스로틀 오류 → 케이블 연결 확인\n• E09: 과전류 오류 → 전원 껐다 재시동 후 재확인\n• E14: 모터 홀센서 오류 → A/S 접수 필요\n• E30: 통신 오류 → 케이블 연결 확인\n오류가 계속되면 A/S 접수를 권장합니다.' },
        // ── 전원 문제 ──
        { label: '전원불량', keywords: ['전원', '안켜', '안켜짐', '작동안함', '켜지지않', '켜지지 않', '꺼짐', '전원불량',
            '안켜져', '꺼져요', '꺼지고', '꺼지네', '됐다가꺼', '됫다가꺼', '잠깐됐다가', '타다가꺼', '주행중꺼', '충전해도안켜', '전원안들어', '불이안들어'],
          answer: '전원이 켜지지 않을 때 확인 순서:\n① 배터리 인디케이터 버튼을 눌러 잔량 확인\n② 배터리가 완전 방전된 경우 충전 후 재시도\n③ 배터리 잠금장치가 완전히 잠겼는지 확인\n④ 키박스(일부 모델) 연결 상태 확인\n위 확인 후에도 해결되지 않으면 A/S 접수를 권장합니다.' },
        // ── 배터리 심화 ──
        { label: '배터리충전', keywords: ['배터리충전', '충전방법', '충전시간', '충전완료', '충전램프', '충전불량', '충전안됨',
            '빳데리', '밧데리', '배때리', '배떼리', '배터리꼿', '충전꼿으면', '충전이안돼', '충전안돼요', '빨간불안꺼져', '녹색안돼', '완충'],
          answer: '배터리 충전 안내:\n• 충전기 전원 연결 후 상태 표시등이 녹색인지 확인\n• 배터리 충전잭에 3핀 플러그 연결 → 적색(충전중) → 녹색(충전완료)\n• 충전 후 즉시 분리 권장\n• 최초 사용 시 반드시 100% 충전 후 사용\n• 운행 후 바로 충전 금지 — 30분~1시간 후 충전\n• 최소 2개월에 1회 이상 충전 (완전방전 시 A/S 불가)' },
        // ── 안장/시트포스트 ──
        { label: '안장시트', keywords: ['안장', '시트포스트', '안장높이', '안장조절', '안장규격', 'φ27'],
          answer: '안장 높이 조절 안내:\n• QR 래버 조절: 범위 약 10cm (래버 올리면 시트 위로)\n• 시트포스트 클램프 조절: 최대 약 14cm 추가 조절 가능\n• 시트포스트 규격: Φ27.2mm\n• ⚠️ 반드시 삽입한계선(MIN INSERT) 이하로 내려오지 않도록 주의 — 초과 시 프레임 파손 위험' },
        // ── 변속 ──
        { label: '변속기어', keywords: ['변속', '기어', '변속기', '기어안바뀜', '변속불량',
            '기어안바껴', '기어가안바껴', '단수조절', '기어이상', '변속이안돼', '기어조절'],
          answer: '변속기 사용 안내:\n• 평지/내리막: 4~7단(고단) 권장\n• 언덕 오를 때: 1~3단(저단) 권장\n• 정차 중 변속 금지\n변속이 안 될 때:\n① 변속 와이어 장력이 느슨한지 확인\n② 변속기 와이어 조정볼트 조절\n③ 위 방법으로 해결 안 되면 A/S 센터 방문 권장' },
        // ── 보증기간 / 보증 부품 ──
        { label: '보증기간', keywords: ['보증', '보증기간', '무상수리', '무상AS', '무상A/S', '보증부품', '보증파츠', '워런티',
            '1년보증', '공짜수리', '무상으로', '보증이되나', '보증되나', '무상처리'],
          answer: '니어바이크 제품 보증 안내:\n\n[무상 보증 대상]\n• 프레임 / 모터 / 배터리\n• 보증 기간: 구매일로부터 1년, 누적 주행거리 3,000km 미만 (1회 한정)\n\n[유상 처리 소모품]\n브레이크, 타이어, 패드, 디스플레이, 컨트롤러, 유성기어, 라이트 등\n\n※ 보증 부품은 무상 제공이나 부품 교체 공임비는 별도 청구될 수 있습니다.\n※ 전국 가까운 대리점에서 A/S 가능합니다.' },
        // ── 보증 제외 항목 ──
        { label: '보증제외', keywords: ['보증제외', '보증안됨', '보증불가', '유상처리', '개조', '침수', '보증조건'],
          answer: '다음의 경우 보증기간 내에도 유상 처리됩니다:\n• 충돌·넘어짐·배터리 부주의 등 고객 취급 부주의\n• 산악주행·다운힐·계단 등 비정상 주행으로 인한 고장\n• 임의 개조 또는 타사 부품 사용\n• 무리한 언덕주행으로 인한 모터/컨트롤러/배터리 손상\n• 침수로 인한 고장\n• 니어바이크 정품 배터리 미사용\n• 최초 구매자가 아닌 경우\n\n⚠️ 배송 중 발생한 경미한 스크래치·도장누락·찍힘은 A/S 대상이 아닙니다.' },
        // ── 보험 ──
        { label: '보험', keywords: ['보험', '보험가입', '손해보험', '배상책임', '사고보험', '퍼스널모빌리티보험', '현대해상'],
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
- 운영시간: 평일 09:00~18:00 (주말/공휴일 휴무)
- 배송: 평균 2~3 영업일, 제주/도서산간 +2일
- 반품: 수령 후 7일 이내 / 단순변심 왕복배송비 고객부담 / 불량·오배송 무료
- 결제수단: 신용카드, 무통장입금, 카카오페이, 네이버페이
- 면허: 전동킥보드 운행 시 원동기면허(또는 이상) 필수, 헬멧 착용 의무
- 주행: 자전거도로 이용 가능(25km/h 이하), 인도·차도 주행 금지, 2인 탑승 금지
- 배터리: 충전 시간·주행거리는 제품별 상이, 완전 방전 상태 장기 보관 금지
- 부품: 정품 부품 권장, 타 브랜드 부품 호환 여부는 제품별 상이

[고객센터·전화 정책]
- 이 챗봇이 곧 고객센터입니다. 전화 상담은 운영하지 않습니다.
- 전화번호·"전화로 연락"·"고객센터로 전화" 같은 통화 안내를 절대 하지 마세요.

[안전·정책 규칙]
1. 위 정보에 없는 내용은 절대 추측하지 마세요.
2. 챗봇으로 해결이 어렵거나 직접 처리가 필요하면 전화가 아니라 "A/S 접수"를 남기도록 안내하세요.
3. 개인정보를 요청하거나 수집하지 마세요.
4. 고객이 불만·화남을 표현하면 공감 후 "A/S 접수"를 남기도록 안내하세요.

[출력 형식] 한국어, 친절하고 간결하게, 3문장 이내`,
      faqs: [
        ...SHARED_FAQS,
        // ── XRB 전용 ──
        {
          label: 'A/S접수',
          keywords: ['AS', 'A/S', '수리', '고장', '파손',
            '고장났', '망가졌', '부서졌', '이상해요', '이상한데', '작동이상', '작동안해', '수리맡기', 'as신청', 'a/s신청'],
          answer: 'A/S 접수는 챗봇의 A/S 접수 버튼으로 바로 남기실 수 있습니다. 보증기간 내 제조 하자는 무상 수리됩니다.',
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
          answer: '전동킥보드 사고 시 일반 교통사고와 동일하게 처리됩니다. 별도 개인형 이동장치 보험 가입을 권장하며, 자세한 사항은 채팅으로 문의하시거나 A/S 접수를 남겨주시면 안내해 드립니다.',
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
          answer: '부품 호환성은 제품 모델별로 다르게 적용됩니다. 모델명을 알려주시면 확인해 드리고, 추가 확인이 필요하면 A/S 접수를 도와드립니다.',
        },
        {
          keywords: ['정품', '순정', '부품 구매', '부품 주문'],
          answer: '정품 부품은 slimpack.co.kr에서 구매하실 수 있습니다. 추가 문의는 A/S 접수를 남겨주세요. 비정품 부품 사용 시 A/S가 제한될 수 있으니 정품 사용을 권장합니다.',
        },
        {
          keywords: ['타이어', '튜브', '바퀴', '펑크'],
          answer: '타이어 및 튜브 교체는 모델별 규격이 다를 수 있습니다. 모델명을 알려주시면 적합한 정품 부품을 안내해 드립니다.',
        },
        {
          keywords: ['업그레이드', '튜닝', '속도 올리기', '개조'],
          answer: '임의 개조 및 속도 제한 해제는 도로교통법 위반이며 안전사고 위험이 있습니다. 또한 제조사 보증이 무효화될 수 있으니 원상태 사용을 권장합니다.',
        },
        // ── 모델 제원 ──
        { keywords: ['제원', '무게', '최고속도', '최대중량', '탑승중량', '몇kg', '몇 kg', '스펙', '모델'],
          answer: 'X-RIDER 모델별 제원:\n• X200 MAX SL: 알루미늄, PAS+스로틀, 최대탑승 120kg, 무게 30kg 미만\n• X200 PRO SL: 알루미늄, PAS+스로틀, 최대탑승 140kg, 무게 30kg 미만\n• X200 GT: 알루미늄, PAS+스로틀, 최대탑승 140kg\n• X100 MAX SL: 알루미늄, PAS+스로틀, 최대탑승 140kg, 무게 30kg 미만\n• X50 FS: 알루미늄, PAS+스로틀, 최대탑승 120kg, 무게 30kg 미만\n※ 전 모델 공통: 최고속도 25km/h 미만' },
        // ── PAS/스로틀 ──
        { keywords: ['PAS', '파스', 'pas', '단계', '속도단계', '어시스트', '스로틀', '모터단계',
            '파스모드', '전동모드', '1단계', '2단계', '3단계', '몇단', '단수조절', '스로틀모드', '크루즈'],
          answer: 'X-RIDER PAS 단계별 최고속도:\n• 0단계: 모터 미작동\n• 1단계: 15km/h\n• 2단계: 20km/h\n• 3단계: 25km/h (최대)\n스로틀: 키박스 우측 스로틀을 돌리면 PAS 단계와 무관하게 모터 작동, 약 20초 유지 시 크루즈모드 진입\n※ 출발 시 PAS 1단계에서 페달을 천천히 밟아 출발 (급발진 예방)' },
        // ── 에러코드 ──
        { label: '에러코드', keywords: ['에러', '오류', '오류코드', 'E002', 'E006', 'E007', 'E008', 'E009', 'E010', 'E011', '에러코드',
            'E02', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', '에러번호', '코드뜨', '화면에숫자', '에러떠', '오류떠', '숫자뜨'],
          answer: '디스플레이 오류코드 안내:\n• E002: 브레이크 동작 중 → 브레이크 레버 확인\n• E006: 저전압(배터리 부족) → 충전 필요\n• E007: 모터 동작 오류 → A/S 접수 필요\n• E008: 스로틀 오류 → 케이블 연결 확인\n• E009: 컨트롤러 오류 → 전원 껐다 재시동\n• E010: 디스플레이 통신 오류 → 케이블 연결 확인\n• E011: 컨트롤러 통신 오류 → A/S 접수 필요\n오류가 계속되면 A/S 접수를 권장합니다.' },
        // ── 전원 문제 ──
        { label: '전원불량', keywords: ['전원', '안켜', '안켜짐', '작동안함', '켜지지않', '켜지지 않', '꺼짐', '전원불량',
            '안켜져', '꺼져요', '꺼지고', '꺼지네', '됐다가꺼', '됫다가꺼', '잠깐됐다가', '타다가꺼', '주행중꺼', '충전해도안켜', '전원안들어'],
          answer: '전원이 켜지지 않을 때 확인 순서:\n① 키박스에 키를 넣고 시계 방향으로 완전히 돌렸는지 확인\n② 배터리 버튼을 눌러 LED 잔량 확인\n③ 배터리 완전 방전 시 충전 후 재시도\n④ 배터리 잠금장치가 완전히 잠겼는지 확인\n위 확인 후에도 해결 안 되면 전체 케이블 연결 점검 후 A/S 접수를 권장합니다.' },
        // ── 배터리 심화 ──
        { label: '배터리충전', keywords: ['배터리충전', '충전방법', '충전시간', '충전완료', '충전램프', '충전불량', '충전안됨',
            '빳데리', '밧데리', '배때리', '배떼리', '배터리꼿', '충전꼿으면', '충전이안돼', '충전안돼요', '빨간불안꺼져', '녹색안돼', '완충'],
          answer: '배터리 충전 안내:\n• 충전기 전원 연결 → 표시등 녹색 확인\n• 배터리 충전잭에 3핀 플러그 연결 → 적색(충전중) → 녹색(충전완료)\n• 최초 사용 시 반드시 100% 충전 후 사용\n• 운행 후 바로 충전 금지 — 30분~1시간 후 충전\n• 최소 2개월에 1회 이상 충전 (완전방전 시 A/S 불가)\n• 배터리는 항상 자전거에서 분리 후 충전' },
        // ── 안장/시트포스트 ──
        { keywords: ['안장', '시트포스트', '안장높이', '안장조절', '안장규격', 'φ27'],
          answer: '안장 높이 조절 안내:\n• X50 FS 시트서스펜션: QR 래버로 약 10cm 조절\n• 시트포스트 클램프: 약 14cm 추가 조절 가능\n• 시트포스트 규격: Φ27.2mm\n• ⚠️ 반드시 삽입한계선(MIN INSERT) 이하로 내려오지 않도록 주의' },
        // ── 변속 ──
        { keywords: ['변속', '기어', '변속기', '기어안바뀜', '변속불량', '7단', '시마노',
            '기어안바껴', '기어가안바껴', '단수조절', '기어이상', '변속이안돼'],
          answer: '변속기 사용 안내:\n• 전기자전거 모드 주행 시: 평지 4~7단, 언덕 1~3단 권장\n• 정차 중 변속 금지\n변속이 안 될 때:\n① 변속 와이어 장력이 느슨한지 확인 (7단에 놓고 와이어 조정볼트 반시계 방향 조절)\n② 위 방법으로 해결 안 되면 A/S 센터 방문 권장' },
        // ── 키박스/키 분실 ──
        { keywords: ['키', '열쇠', '키분실', '열쇠분실', '여분키', '키복사'],
          answer: '키박스 키는 동일 키 2개(고유키)만 제공되며 추가 제공이 어렵습니다. 분실 시 A/S 접수를 남겨주시면 처리 방법을 안내해 드립니다.' },
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

  // 세션 ID (채팅 로그 연결용)
  const SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

  // 브랜드별 FAQ / 시스템 프롬프트 사용 (DB 로딩 전 기본값)
  let FAQS = BRAND.faqs;
  const SYSTEM_PROMPT = BRAND.systemPrompt;

  // DB에서 FAQ 로딩 (sessionStorage 1시간 캐시, 실패 시 기본값 유지)
  (function loadFaqsFromDB() {
    if (!CONFIG.useLlmProxy) return; // 로컬 개발 시 스킵
    try {
      const cacheKey = 'chatbot_faq_' + BRAND_KEY;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 3600000 && data && data.length > 0) { FAQS = data; return; }
      }
      fetch(CONFIG.apiUrl + '/.netlify/functions/chatbot-faq-list?brand=' + BRAND_KEY)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          if (json && json.faqs && json.faqs.length > 0) {
            FAQS = json.faqs;
            sessionStorage.setItem(cacheKey, JSON.stringify({ data: json.faqs, ts: Date.now() }));
          }
        })
        .catch(() => {});
    } catch (e) {}
  })();

  // 운영설정(ON/OFF·시간) — 기본 활성, 실패 시 활성 유지
  let CHAT_SETTINGS = { enabled: true, withinHours: true, offhoursMessage: '', offhoursImageUrl: null };
  let _hostEl = null;
  (function loadChatSettings() {
    if (!CONFIG.useLlmProxy) return;
    fetch(CONFIG.apiUrl + '/.netlify/functions/chatbot-settings?brand=' + BRAND_KEY)
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (!s) return;
        CHAT_SETTINGS = {
          enabled: s.enabled !== false,
          withinHours: s.withinHours !== false,
          offhoursMessage: s.offhours_message || '',
          offhoursImageUrl: s.offhours_image_url || null,
        };
        if (!CHAT_SETTINGS.enabled && _hostEl) _hostEl.style.display = 'none';
      })
      .catch(() => {});
  })();

  const ESCALATION_SIGNALS = ['화나', '짜증', '환불해줘', '고소', '신고', '사기', '최악', '불량품', '소비자원', '항의'];
  const ORDER_INTENT = ['주문조회', '주문 조회', '주문번호', '배송조회', '배송 조회', '운송장'];
  const SERVICE_INTENT = ['as현황', 'a/s현황', 'as 현황', 'a/s 현황', '접수현황', '접수 현황', '수리현황', '접수번호', 'as접수', 'a/s접수'];
  const TIRE_INTENT = ['펑크', '타이어교체', '타이어 교체', '타이어구매', '튜브교체', '튜브 교체', '이너튜브', '타이어규격'];
  const DEALER_INTENT = ['대리점', '판매점', '판매처', '구매처', '가맹점', '어디서살', '어디서구매', '근처매장', '가까운매장', '오프라인'];

  const DEALER_INFO = {
    nb: { link: 'https://nearbike.co.kr/dealer/list.html', linkLabel: '니어바이크 대리점 찾기', regions: '서울·인천·경기·충청·경상·전라·강원·제주' },
    xrb: { link: 'https://xrider.co.kr/shopinfo/dealer.html', linkLabel: 'X-RIDER 판매점 안내', regions: '전국 판매점' },
  };

  const TIRE_INFO = {
    xrb: {
      models: [],
      default: {
        spec: '이너튜브 20×4.5~4.8',
        link: 'https://xrider.co.kr/product/%EC%9D%B4%EB%84%88%ED%8A%9C%EB%B8%8C-20x45-48-1%EA%B0%9C/6267/category/221/display/1/',
        linkLabel: 'X-RIDER 공식 스토어',
      },
    },
    nb: {
      // 레트로미니를 레트로 앞에 배치 — 부분 문자열 매칭 우선순위
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
      default: {
        spec: null,
        link: 'https://nearbike.co.kr/product/search.html?banner_action=&keyword=%ED%8A%9C%EB%B8%8C',
        linkLabel: '니어바이크 튜브 검색',
      },
    },
  };

  // ─── NB 대리점 데이터 (지역별) ───────────────────────────────────────────
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

  const NB_DEALER_REGION_CHIPS = [
    ...Object.keys(NB_DEALERS).map(r => ({ label: `🗺️ ${r}`, value: `__region_${r}` })),
    { label: '🏠 처음으로', value: '__restart__' },
  ];

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

  const GREETING_TRIGGERS = ['안녕', '반갑', '처음', '잘부탁', 'hi', 'hello', '헬로', '하이'];
  const CANCEL_SIGNALS = ['취소', '그만', '중단', '돌아가', '처음으로', '메인으로', '안할게', '그만할게', '그냥둬', '됐어'];

  function isCancel(text) {
    const n = text.toLowerCase().replace(/\s/g, '');
    return CANCEL_SIGNALS.some(kw => n.includes(kw));
  }

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

  function detectTireIntent(msg) {
    const n = msg.toLowerCase().replace(/\s/g, '');
    return TIRE_INTENT.some((kw) => n.includes(kw.replace(/\s/g, '')));
  }

  function detectDealerIntent(msg) {
    const n = msg.toLowerCase().replace(/\s/g, '');
    return DEALER_INTENT.some((kw) => n.includes(kw.replace(/\s/g, '')));
  }

  function lookupTire(model) {
    const brandInfo = TIRE_INFO[BRAND_KEY];
    if (!brandInfo) return null;
    const n = model.toLowerCase().replace(/\s/g, '');
    for (const entry of (brandInfo.models || [])) {
      if (entry.names.some(name => n.includes(name.toLowerCase().replace(/\s/g, '')))) return entry;
    }
    return brandInfo.default || null;
  }

  function buildTireAnswer(model) {
    const info = lookupTire(model);
    if (!info) return '해당 모델 정보를 찾을 수 없습니다. 모델명을 다시 알려주시거나 A/S 접수를 남겨주시면 담당자가 확인 후 안내해 드립니다.';
    const specLine = info.spec ? `• 규격: ${info.spec}\n` : '';
    return `${model} 타이어(튜브) 안내 🔧\n\n${specLine}• 구매: <a href="${info.link}" target="_blank" rel="noopener" style="color:#1a73e8">${info.linkLabel}</a>\n\n정품 사용을 권장하며, 교체 시 대리점 또는 A/S 센터 방문을 추천드립니다.`;
  }

  // 구어체·오타 정규화 — 심각한 표기 오류를 키워드 매칭 가능한 형태로 보정
  function normalizeInput(text) {
    let n = text.toLowerCase().replace(/\s/g, '');
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

  function buildDealerListHtml(region) {
    const list = NB_DEALERS[region];
    if (!list || list.length === 0) return `${region} 지역 대리점 정보가 없습니다.`;
    const items = list.map((d, i) =>
      `<b>${i + 1}. ${d.name}</b>\n📞 ${d.phone}\n📌 ${d.address}`
    ).join('\n\n');
    return `🗺️ ${region} 대리점 (총 ${list.length}곳)\n\n${items}`;
  }

  function matchFaqs(msg, maxResults = 4) {
    const n = normalizeInput(msg);
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

  function logFaqMatch(userMsg, faqLabel) {
    if (!CONFIG.useLlmProxy) return;
    fetch(`${CONFIG.apiUrl}/.netlify/functions/chatbot-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'log', message: userMsg, matched_label: faqLabel, brand: BRAND_KEY, session_id: SESSION_ID }),
    }).catch(() => {});
  }

  async function callLlm(msg, history) {
    if (CONFIG.useLlmProxy) {
      // 프로덕션: Netlify Function → Claude Haiku (smart 모드: FAQ 분류 + 답변 1회 호출)
      const labels = FAQS.filter(f => f.label).map(f => f.label);
      const res = await fetch(`${CONFIG.apiUrl}/.netlify/functions/chatbot-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'smart', message: msg, labels, history: history.slice(-6), brand: BRAND_KEY, session_id: SESSION_ID }),
      });
      if (!res.ok) throw new Error('LLM 오류');
      const data = await res.json();
      // smart 모드: FAQ 분류 성공 → { type: 'faq', label }
      if (data.type === 'faq' && data.label) {
        const faq = FAQS.find(f => f.label === data.label);
        if (faq) return { isFaq: true, faq };
      }
      // 일반 답변 또는 분류 실패
      return { isFaq: false, reply: data.reply || '잠시 후 다시 시도해주세요.' };
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
      return { isFaq: false, reply: data.message?.content || '잠시 후 다시 시도해주세요.' };
    }
  }

  // RAG: FAQ 전체를 지식으로 주고 사람처럼 자연스럽게(Sonnet) 답변
  async function ragLlm(msg, history) {
    if (!CONFIG.useLlmProxy) {
      const r = await callLlm(msg, history);
      return r.reply || '잠시 후 다시 시도해주세요.';
    }
    const knowledge = FAQS.filter(f => f.label && f.answer).map(f => `### ${f.label}\n${f.answer}`).join('\n\n');
    const res = await fetch(`${CONFIG.apiUrl}/.netlify/functions/chatbot-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'rag', message: msg, knowledge, history: history.slice(-6), brand: BRAND_KEY, session_id: SESSION_ID }),
    });
    if (!res.ok) throw new Error('LLM 오류');
    const data = await res.json();
    return data.reply || '잠시 후 다시 시도해주세요. 계속 안 되면 A/S 접수를 남겨주세요.';
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
      width: 380px; max-width: calc(100vw - 32px); max-height: min(600px, calc(100vh - 120px));
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
    _hostEl = host;
    if (CHAT_SETTINGS.enabled === false) host.style.display = 'none'; // OFF면 위젯 숨김
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

      // 시스템 칩 값(__*__)은 사용자 말풍선에 미표시, __faq_N / __region_*은 레이블로 표시
      if (text.startsWith('__faq_')) {
        addTextMsg(FAQS[parseInt(text.slice(6), 10)]?.keywords[0] || text, 'user');
      } else if (text.startsWith('__region_')) {
        addTextMsg(text.slice(9) + ' 대리점', 'user');
      } else if (!text.startsWith('__')) {
        addTextMsg(text, 'user');
      }
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

        // 대리점 지역 칩 선택
        } else if (text.startsWith('__region_')) {
          const region = text.slice(9);
          hideTyping();
          if (NB_DEALERS[region]) {
            addTextMsg(buildDealerListHtml(region), 'bot', 'badge-faq', '대리점');
          } else {
            addTextMsg(`${region} 지역 대리점 정보가 없습니다.`, 'bot');
          }
          addQuickReplies([
            { label: '↩️ 다른 지역', value: '__dealer_back__' },
            { label: '🏠 처음으로', value: '__restart__' },
          ]);

        // 대리점 지역 재선택
        } else if (text === '__dealer_back__') {
          hideTyping();
          addTextMsg('어느 지역 대리점을 찾고 계세요? 🗺️', 'bot');
          addQuickReplies(NB_DEALER_REGION_CHIPS);

        // FAQ 선택 칩
        } else if (text.startsWith('__faq_')) {
          const idx = parseInt(text.slice(6), 10);
          const faq = FAQS[idx];
          hideTyping();
          if (faq) {
            logFaqMatch(text, faq.label);
            addTextMsg(faq.answer, 'bot', 'badge-faq', 'FAQ');
            addQuickReplies([
              { label: '📝 A/S 접수하기', value: '__as_register__' },
              { label: '🏠 처음으로', value: '__restart__' },
            ]);
          }

        // 2. 감정 신호 → 즉시 이관
        } else if (detectEscalation(text)) {
          hideTyping();
          addTextMsg('불편을 드려 정말 죄송합니다. 😔\n빠르게 도와드릴 수 있도록 A/S 접수를 남겨주시면 담당자가 확인 후 신속하게 처리해 드리겠습니다.', 'bot', 'badge-escalate', 'A/S 접수 유도');
          convState = { step: 'IDLE', orderNo: null, buyerName: null, asName: null, asPhone: null, asProduct: null };

        // 2-1. 진행 중인 플로우에서 취소 의도 → IDLE 복귀
        } else if (convState.step !== 'IDLE' && isCancel(text)) {
          hideTyping();
          convState = { step: 'IDLE', orderNo: null, buyerName: null, asName: null, asPhone: null, asProduct: null };
          addTextMsg('취소했습니다. 처음으로 돌아갈게요. 😊\n무엇을 도와드릴까요?', 'bot');
          addQuickReplies(CATEGORY_CHIPS);

        // 2-2. 주문 조회 — 주문번호 대기 중
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
            addTextMsg('A/S 접수 정보를 찾을 수 없습니다. 접수번호 또는 연락처를 다시 확인해주세요.\n처음 접수하시는 경우 A/S 접수를 새로 남겨주세요.', 'bot');
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
            `A/S 접수가 완료되었습니다. ✅\n\n접수번호: ${serviceId}\n성함: ${asName}\n제품: ${asProduct}\n\n담당자 확인 후 순차적으로 처리해 드리겠습니다. (평일 09:00~18:00)`,
            'bot', 'badge-lookup', 'A/S 접수'
          );
          addQuickReplies([
            { label: '🏠 처음으로', value: '__restart__' },
          ]);

        // 5-1. 타이어 모델 대기
        } else if (convState.step === 'TIRE_AWAIT_MODEL') {
          hideTyping();
          convState.step = 'IDLE';
          addTextMsg(buildTireAnswer(text.trim()), 'bot', 'badge-faq', '타이어');
          addQuickReplies([
            { label: '📝 A/S 접수하기', value: '__as_register__' },
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

        // 7-1. 대리점 안내
        } else if (detectDealerIntent(text)) {
          hideTyping();
          if (BRAND_KEY === 'nb') {
            addTextMsg('가까운 대리점을 찾아드릴게요! 🗺️\n어느 지역인지 선택해주세요.', 'bot', 'badge-faq', '대리점');
            addQuickReplies(NB_DEALER_REGION_CHIPS);
          } else {
            const d = DEALER_INFO[BRAND_KEY];
            addTextMsg(
              `가까운 대리점을 찾아드릴게요! 🗺️\n\n• <a href="${d.link}" target="_blank" rel="noopener" style="color:${BRAND.color}">${d.linkLabel}</a>\n\n${d.regions} 지역별로 확인 가능합니다.`,
              'bot', 'badge-faq', '대리점'
            );
            addQuickReplies([{ label: '🏠 처음으로', value: '__restart__' }]);
          }

        // 7-2. 타이어/펑크 의도 감지
        } else if (detectTireIntent(text)) {
          hideTyping();
          convState.step = 'TIRE_AWAIT_MODEL';
          addTextMsg('타이어(튜브) 교체를 도와드릴게요. 🔧\n사용 중인 모델명을 알려주세요.', 'bot');
          addHint(BRAND_KEY === 'xrb' ? '예: X200 MAX SL / X50 FS' : '예: 블레이드FS / 카고');

        // 8. 인사 감지 → 환영 + 메뉴
        } else if (GREETING_TRIGGERS.some(kw => text.toLowerCase().replace(/\s/g,'').includes(kw))) {
          hideTyping();
          addTextMsg(`안녕하세요! ${BRAND.name}입니다. ${BRAND.avatar}\n무엇을 도와드릴까요? 😊`, 'bot');
          addQuickReplies(CATEGORY_CHIPS);

        // 9. 그 외 자유 질문 → RAG 자연어 답변 (FAQ 지식 기반 + 맥락 유지)
        } else {
          const reply = await ragLlm(text, history);
          hideTyping();
          addTextMsg(reply, 'bot', 'badge-ai', 'AI');
          history.push({ role: 'user', content: text });
          history.push({ role: 'assistant', content: reply });
          addQuickReplies([
            { label: '📝 A/S 접수하기', value: '__as_register__' },
            { label: '🏠 처음으로', value: '__restart__' },
          ]);
        }
      } catch {
        hideTyping();
        addTextMsg('죄송합니다, 잠시 후 다시 시도해주세요.\n계속 문제가 있으면 A/S 접수를 남겨주시면 담당자가 확인해 드립니다.', 'bot');
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
        // 운영시간 외 안내
        if (!CHAT_SETTINGS.withinHours && CHAT_SETTINGS.offhoursMessage) {
          addTextMsg(CHAT_SETTINGS.offhoursMessage, 'bot', 'badge-escalate', '상담시간 외');
          if (CHAT_SETTINGS.offhoursImageUrl) {
            addTextMsg(`<img src="${CHAT_SETTINGS.offhoursImageUrl}" alt="안내" style="max-width:100%;border-radius:8px">`, 'bot');
          }
        }
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
      const S = 56, gap = 10, margin = 8;
      // 패널 너비는 화면 폭에 맞춰 제한 (좁은 화면 잘림 방지)
      const W = Math.min(380, window.innerWidth - margin * 2);
      // 기본은 버튼 오른쪽, 넘치면 버튼 왼쪽
      let wLeft = btnLeft + S + gap;
      if (wLeft + W > window.innerWidth) wLeft = btnLeft - W - gap;
      // 좌우 경계 내로 강제 클램핑
      wLeft = Math.max(margin, Math.min(wLeft, window.innerWidth - W - margin));
      const H = chatWindow.offsetHeight || 520;
      // 기본은 버튼 위로 띄우되, 상하 경계 내로 클램핑
      let wTop = btnTop + S - H;
      wTop = Math.max(margin, Math.min(wTop, window.innerHeight - H - margin));
      chatWindow.style.right  = '';
      chatWindow.style.bottom = '';
      chatWindow.style.left   = wLeft + 'px';
      chatWindow.style.top    = wTop  + 'px';
    }

    // 저장 좌표를 화면 경계 내로 강제 클램핑 (좁아진 화면/스테일 좌표로 버튼이 화면 밖에 숨는 문제 방지)
    function clampBtnPos(left, top) {
      const maxL = Math.max(0, window.innerWidth  - 56);
      const maxT = Math.max(0, window.innerHeight - 56);
      return {
        left: Math.max(0, Math.min(Number(left) || 0, maxL)),
        top:  Math.max(0, Math.min(Number(top)  || 0, maxT)),
      };
    }

    const savedPos = (() => { try { return JSON.parse(localStorage.getItem(POS_KEY)); } catch { return null; } })();
    if (savedPos && Number.isFinite(Number(savedPos.left)) && Number.isFinite(Number(savedPos.top))) {
      const p = clampBtnPos(savedPos.left, savedPos.top);
      applyBtnPos(p.left, p.top);
      applyWindowPos(p.left, p.top);
    }

    // 화면 크기 변경 시 버튼이 경계 밖으로 나가면 다시 안으로 끌어옴
    window.addEventListener('resize', () => {
      if (!toggleBtn.style.left) return; // 기본(우하단 CSS) 위치면 무시
      const p = clampBtnPos(parseFloat(toggleBtn.style.left), parseFloat(toggleBtn.style.top));
      applyBtnPos(p.left, p.top);
      if (isOpen) applyWindowPos(p.left, p.top);
    });

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
