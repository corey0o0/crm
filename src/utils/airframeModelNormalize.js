/**
 * 기종별 매출 집계용 표준 모델명.
 * - 색상 / "N대" / 시승 표기 제거
 * - 한·영·띄어쓰기 별칭을 표준 기종키로 합침
 * - 규칙 순서는 긴 패턴 우선 (X200 맥스 SL → X200 MAX 보다 먼저)
 */

const RULES = [
  { re: /x200\s*gt|x200gt/, name: 'X200 GT' },
  { re: /x100\s*gt|x100gt/, name: 'X100 GT' },
  { re: /x50\s*gt|x50gt/, name: 'X50 GT' },
  { re: /터보\s*gt|turbo\s*gt|터보gt/, name: '터보 GT' },
  { re: /x200\s*듀오|x200\s*duo/, name: 'X200 듀오' },
  { re: /x200\s*맥스\s*sl|x200\s*max\s*sl|x200맥스\s*sl|x200max\s*sl/, name: 'X200 맥스 SL' },
  { re: /x200\s*프로\s*sl|x200\s*pro\s*sl|x200프로\s*sl|x200pro\s*sl/, name: 'X200 프로 SL' },
  { re: /x200\s*max|x200\s*맥스|x200맥스|x200max/, name: 'X200 MAX' },
  { re: /x200\s*pro|x200\s*프로|x200프로|x200pro/, name: 'X200 Pro' },
  { re: /x100\s*맥스\s*sl|x100\s*max\s*sl|x100맥스\s*sl/, name: 'X100 맥스 SL' },
  { re: /x100\s*max|x100\s*맥스|x100맥스|x100max/, name: 'X100 MAX' },
  { re: /x100\s*pro|x100\s*프로|x100프로|x100pro/, name: 'X100 Pro' },
  { re: /x50\s*fs|x50fs/, name: 'X50 FS' },
  { re: /x50\s*sl|x50sl/, name: 'X50 SL' },
  { re: /x50(?![0-9a-z])/, name: 'X50' },
  { re: /turbo\s*pro|터보\s*pro|터보프로|turbopro/, name: 'Turbo Pro' },
  { re: /turbo\s*s|터보\s*s|터보s|turbos/, name: 'Turbo S' },
  // NB 레트로 계열을 미니/레트로 단독보다 먼저 매칭 (「레트로 미니」가 「미니」로 먹히지 않게)
  { re: /레트로\s*미니|retro\s*mini/, name: '레트로 미니' },
  { re: /레트로\s*fs\s*2|retro\s*fs\s*2|레트로fs2|retrofs2/, name: '레트로 FS2' },
  { re: /레트로\s*fs|retro\s*fs/, name: '레트로 FS' },
  { re: /레트로\s*투어|retro\s*tour/, name: '레트로 투어' },
  { re: /레트로|retro/, name: '레트로' },
  { re: /mini\s*pro|미니\s*pro|미니프로/, name: '미니 Pro' },
  { re: /(?:^|[\s\-])mini(?:[\s\-]|$)|미니/, name: '미니' },
  { re: /블레이드\s*fs|blade\s*fs/, name: '블레이드 FS' },
  { re: /블레이드|blade/, name: '블레이드' },
  { re: /카고\s*lt|cargo\s*lt/, name: '카고 LT' },
  { re: /카고|cargo/, name: '카고' },
  { re: /클래식|classic/, name: '클래식' },
  { re: /스프린터|sprinter/, name: '스프린터' },
];

// 기종 표준명(한글/혼용) → 영문 표기. RULES의 name 값과 1:1 대응.
const MODEL_NAME_EN = {
  'X200 GT': 'X200 GT',
  'X100 GT': 'X100 GT',
  'X50 GT': 'X50 GT',
  '터보 GT': 'Turbo GT',
  'X200 듀오': 'X200 Duo',
  'X200 맥스 SL': 'X200 Max SL',
  'X200 프로 SL': 'X200 Pro SL',
  'X200 MAX': 'X200 Max',
  'X200 Pro': 'X200 Pro',
  'X100 맥스 SL': 'X100 Max SL',
  'X100 MAX': 'X100 Max',
  'X100 Pro': 'X100 Pro',
  'X50 FS': 'X50 FS',
  'X50 SL': 'X50 SL',
  'X50': 'X50',
  'Turbo Pro': 'Turbo Pro',
  'Turbo S': 'Turbo S',
  '레트로 미니': 'Retro Mini',
  '레트로 FS2': 'Retro FS2',
  '레트로 FS': 'Retro FS',
  '레트로 투어': 'Retro Tour',
  '레트로': 'Retro',
  '미니 Pro': 'Mini Pro',
  '미니': 'Mini',
  '블레이드 FS': 'Blade FS',
  '블레이드': 'Blade',
  '카고 LT': 'Cargo LT',
  '카고': 'Cargo',
  '클래식': 'Classic',
  '스프린터': 'Sprinter',
};

/**
 * 기종 표준명을 영문 표기로 변환. 매핑 없으면 원문 유지.
 * @param {string} name
 * @returns {string}
 */
export function toEnglishModelName(name) {
  return MODEL_NAME_EN[name] || name;
}

// 상품관리 기종 선택용 표준 기종 목록 (RULES와 1:1 대응 순서)
export const ALL_MODEL_NAMES = Object.keys(MODEL_NAME_EN);

const COLOR_TAIL =
  /\s*(?:-|–|—)?\s*(블랙|화이트|베이지|그레이|핑크|틸블루|미러크롬|메탈\s*그레이|어반\s*그레이|샌드\s*베이지|매트\s*블랙|유광\s*블랙|로얄\s*네이비|어반\s*그린|아미\s*그린|메탈그레이|샌드베이지|그레이|네이비|그린).*$/i;

/**
 * 알려진 기종 키워드로만 매칭 (fallback 없음). 매칭 안되면 null.
 * @param {string} raw
 * @returns {string|null}
 */
export function matchKnownAirframeModel(raw) {
  if (!raw) return null;
  const n = String(raw)
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[_\s]+/g, ' ')
    .trim();
  for (const rule of RULES) {
    if (rule.re.test(n)) return rule.name;
  }
  return null;
}

/**
 * 호환 기종이 여러 개인 공용 부속("... - 터보GT/X200GT/X100GT/레트로FS")은
 * '/'로 구분된 조각별로 매칭해 전부 반환. 매칭 안되면 빈 배열.
 * @param {string} raw
 * @returns {string[]}
 */
export function matchAllKnownAirframeModels(raw) {
  if (!raw) return [];
  const names = [];
  for (const seg of String(raw).split('/')) {
    const name = matchKnownAirframeModel(seg);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * @param {string} raw - 원본 상품/부품명 (오프라인 part_name 또는 온라인 resolve 결과)
 * @returns {string} 표준 기종명
 */
export function normalizeAirframeModelName(raw) {
  if (!raw) return '알 수 없는 기체';
  let s = String(raw).trim();
  if (!s) return '알 수 없는 기체';

  // 수량/시승 잡음 제거
  s = s
    .replace(/\s*\d+\s*대\s*$/g, '')
    .replace(/시승기체\s*결제건/gi, '')
    .replace(/\(시승[^)]*\)/g, '')
    .replace(/\[시승[^\]]*\]/g, '')
    .trim();

  // 매칭용 정규화 (소문자, 연속 공백 축소, 괄호 제거)
  const n = s
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[_\s]+/g, ' ')
    .trim();

  for (const rule of RULES) {
    if (rule.re.test(n)) return rule.name;
  }

  // 규칙 미매칭: "이름 - 색상" / 끝 색상 단어 제거 후 원문 유지
  let fallback = s;
  if (fallback.includes(' - ')) {
    fallback = fallback.split(' - ')[0].trim();
  }
  fallback = fallback.replace(COLOR_TAIL, '').trim();
  // 영문 중복 병기 "블레이드 FS Blade FS" → 앞쪽 한글 토큰 위주 정리
  fallback = fallback.replace(/\s{2,}/g, ' ').trim();

  return fallback || '알 수 없는 기체';
}
