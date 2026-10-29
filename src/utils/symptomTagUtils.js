// 전체 AS 화면(등록/수정)에서 공통으로 쓰는 추천 태그 목록.
// 전에는 AddService.jsx / ServiceDetail.jsx 에 각각 다른 목록이 중복돼 있었음 —
// 새 태그 유형 추가할 땐 이 배열 하나만 고치면 됨.
export const PREDEFINED_TAGS = [
  '배터리스위치', 'DBSM', '배터리', '충전기', '모터', '컨트롤러',
  '브레이크', '브레이크-패드', '브레이크-로터', '브레이크-교체',
  '타이어', '펑크', '전체점검', '전원불량', '에러코드', '변속기',
  '체인', '안장', '워런티', '사고-보험', '사고수리',
  '디스플레이', '소음', '핸들', 'PAS', '충전안됨',
  'E010', 'E004', 'E007', 'E07', 'E09',
];

export const SYMPTOM_TAG_RULES = [
  { keywords: ['배터리', '배떼리', '밧데리', '밧떼리', '방전', '배충'], tag: '배터리' },
  { keywords: ['충전기', '어댑터', '충전선'], tag: '충전기' },
  { keywords: ['전원', '꺼짐', '안켜', '안켜짐', '부팅'], tag: '전원불량' },
  { keywords: ['에러', '오류', 'E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', '에러코드'], tag: '에러코드' },
  { keywords: ['브레이크', '제동', '브레크'], tag: '브레이크' },
  { keywords: ['패드'], tag: '브레이크-패드' },
  { keywords: ['디스크', '로터'], tag: '브레이크-로터' },
  { keywords: ['변속', '기어', '변속기'], tag: '변속기' },
  { keywords: ['펑크', '타이어', '튜브', '공기'], tag: '펑크' },
  { keywords: ['모터', '구동', '허브모터'], tag: '모터' },
  { keywords: ['체인'], tag: '체인' },
  { keywords: ['안장', '시트포스트', '씨트포스트'], tag: '안장' },
  { keywords: ['보증', '워런티', '무상', '보증기간'], tag: '워런티' },
  { keywords: ['사고', '충돌', '보험'], tag: '사고-보험' },
  { keywords: ['디스플레이', '액정', '화면', '계기판'], tag: '디스플레이' },
  { keywords: ['소음', '잡소리', '삐걱', '덜컹'], tag: '소음' },
  { keywords: ['핸들', '조향', '스티어링'], tag: '핸들' },
  { keywords: ['점검', '전체점검', '정기점검'], tag: '전체점검' },
  { keywords: ['pas', 'PAS', '파스', '어시스트'], tag: 'PAS' },
  { keywords: ['스위치', '배터리스위치'], tag: '배터리스위치' },
];

// 워런티(무상) 처리 여부 판정: 태그에 '워런티' 포함 OR 사용부품 용도(usage)에 '워런티' 포함.
// ServiceList.jsx의 태그검색(tag_name/usage 둘다 ilike 매칭)과 기준을 맞춤.
export function isWarrantyService(service) {
  const tags = (service.service_tags || []).map(t => t.tag_name);
  if (tags.some(t => t.includes('워런티'))) return true;
  return (service.service_parts || []).some(p => (p.usage || '').includes('워런티'));
}

export function extractTagsFromSymptom(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = new Set();
  for (const rule of SYMPTOM_TAG_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      matched.add(rule.tag);
    }
  }
  return [...matched];
}

// 완료된 서비스 목록을 증상 키워드별로 묶어 상관관계 데이터 반환
export function groupServicesByKeyword(services) {
  const groups = {};

  for (const svc of services) {
    if (!svc.symptom || !svc.solution) continue;
    const matchedTags = extractTagsFromSymptom(svc.symptom);
    const tags = matchedTags.length > 0 ? matchedTags : ['기타'];
    const solKey = svc.solution.trim().slice(0, 60);

    for (const tag of tags) {
      if (!groups[tag]) groups[tag] = { count: 0, solutions: {} };
      groups[tag].count++;
      groups[tag].solutions[solKey] = (groups[tag].solutions[solKey] || 0) + 1;
    }
  }

  return Object.entries(groups)
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      topSolutions: Object.entries(data.solutions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([solution, count]) => ({ solution, count })),
    }))
    .sort((a, b) => b.count - a.count);
}
