// 상세화면 다녀온 뒤(브라우저 뒤로가기 포함) localStorage에 저장된 검색/필터 상태를
// performServerSearch에 넘길 파라미터로 변환. 저장된 "활성" 검색/필터가 없으면 null.
export function computeRestoredSearchParams(savedFiltersJson) {
  if (!savedFiltersJson) return null;
  let fs;
  try {
    fs = JSON.parse(savedFiltersJson);
  } catch {
    return null;
  }

  const term = (fs.searchTerm || '').trim();
  const modelTerm = (fs.modelSearchTerm || '').trim();
  const solutionTerm = (fs.solutionSearchTerm || '').trim();
  const partsTerm = (fs.partsSearchTerm || '').trim();
  const hasActive = term.length >= 2 || (fs.selectedStatuses || []).length > 0 ||
    (fs.selectedTags || []).length > 0 ||
    (fs.dateFilter && (fs.dateFilter.startDate || fs.dateFilter.endDate)) ||
    modelTerm || solutionTerm || partsTerm;
  if (!hasActive) return null;

  return {
    searchTerm: term,
    selectedStatuses: fs.selectedStatuses || [],
    selectedTags: fs.selectedTags || [],
    dateFilter: fs.dateFilter || null,
    searchMode: fs.searchMode || 'AND',
    modelSearchTerm: modelTerm,
    solutionSearchTerm: solutionTerm,
    partsSearchTerm: partsTerm,
  };
}
