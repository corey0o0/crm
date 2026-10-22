import { computeRestoredSearchParams } from './serviceListSearchRestore';

describe('computeRestoredSearchParams', () => {
  test('저장된 값 없으면 null', () => {
    expect(computeRestoredSearchParams(null)).toBeNull();
    expect(computeRestoredSearchParams('')).toBeNull();
  });

  test('깨진 JSON이면 null', () => {
    expect(computeRestoredSearchParams('{not json')).toBeNull();
  });

  test('아무 필터도 활성 상태 아니면 null', () => {
    expect(computeRestoredSearchParams(JSON.stringify({ searchTerm: '이' }))).toBeNull();
  });

  test('검색어 2자 이상이면 복원 파라미터 반환', () => {
    const result = computeRestoredSearchParams(JSON.stringify({ searchTerm: '이동현' }));
    expect(result).toEqual({
      searchTerm: '이동현',
      selectedStatuses: [],
      selectedTags: [],
      dateFilter: null,
      searchMode: 'AND',
      modelSearchTerm: '',
      solutionSearchTerm: '',
      partsSearchTerm: '',
    });
  });

  test('검색어 없어도 태그/상태 등 다른 필터가 있으면 복원', () => {
    const result = computeRestoredSearchParams(JSON.stringify({ selectedTags: ['DBSM'] }));
    expect(result.selectedTags).toEqual(['DBSM']);
  });
});
