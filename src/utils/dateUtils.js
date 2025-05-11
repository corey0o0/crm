// KST 변환 함수 제거
// export function toKST(dateString) { ... } // 삭제

export function formatKoreanDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/\. /g, '.').replace(/\.$/, '');
} 