/**
 * 기종별 매출 집계용 표준 모델명.
 * - 색상 / "N대" / 시승 표기 제거
 * - 한·영·띄어쓰기 별칭을 표준 기종키로 합침
 * - 규칙 순서는 긴 패턴 우선 (X200 맥스 SL → X200 MAX 보다 먼저)
 */

const RULES = [
  { re: /x200\s*듀오|x200\s*duo/, name: 'X200 듀오' },
  { re: /x200\s*맥스\s*sl|x200\s*max\s*sl|x200맥스\s*sl|x200max\s*sl/, name: 'X200 맥스 SL' },
  { re: /x200\s*프로\s*sl|x200\s*pro\s*sl|x200프로\s*sl|x200pro\s*sl/, name: 'X200 프로 SL' },
  { re: /x200\s*max|x200\s*맥스|x200맥스|x200max/, name: 'X200 MAX' },
  { re: /x200\s*pro|x200\s*프로|x200프로|x200pro/, name: 'X200 Pro' },
  { re: /x100\s*맥스\s*sl|x100\s*max\s*sl|x100맥스\s*sl/, name: 'X100 맥스 SL' },
  { re: /x100\s*max|x100\s*맥스|x100맥스|x100max/, name: 'X100 MAX' },
  { re: /x100\s*pro|x100\s*프로|x100프로|x100pro/, name: 'X100 Pro' },
  { re: /x50\s*fs|x50fs/, name: 'X50 FS' },
  { re: /x50(?![0-9a-z])/, name: 'X50' },
  { re: /turbo\s*pro|터보\s*pro|터보프로|turbopro/, name: 'Turbo Pro' },
  { re: /turbo\s*s|터보\s*s|터보s|turbos/, name: 'Turbo S' },
  // NB 레트로 계열을 미니/레트로 단독보다 먼저 매칭 (「레트로 미니」가 「미니」로 먹히지 않게)
  { re: /레트로\s*미니|retro\s*mini/, name: '레트로 미니' },
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

const COLOR_TAIL =
  /\s*(?:-|–|—)?\s*(블랙|화이트|베이지|그레이|핑크|틸블루|미러크롬|메탈\s*그레이|어반\s*그레이|샌드\s*베이지|매트\s*블랙|유광\s*블랙|로얄\s*네이비|어반\s*그린|아미\s*그린|메탈그레이|샌드베이지|그레이|네이비|그린).*$/i;

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
