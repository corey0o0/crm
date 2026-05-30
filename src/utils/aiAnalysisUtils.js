import { API_CONFIG } from '../config/api';

/**
 * Ollama에 설치된 모델 목록 가져오기
 */
export const getOllamaModels = async () => {
  try {
    // 개발 환경에서는 프록시를 통해 접근 (CORS 문제 해결)
    const apiUrl = process.env.NODE_ENV === 'development'
      ? '/__ollama/api/tags'
      : 'http://localhost:11434/api/tags';

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Ollama 모델 목록을 가져올 수 없습니다.');
    }
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Ollama 모델 목록 조회 오류:', error);
    return [];
  }
};

/**
 * OpenAI API 호출 함수
 * @param {string} prompt - 사용자 프롬프트
 * @param {string|null} systemPrompt - 시스템 프롬프트
 * @param {string|null} customModel - 사용자 지정 모델 (선택사항)
 */
export const callOpenAI = async (prompt, systemPrompt = null, customModel = null) => {
  try {
    // 로컬 LLM 사용 여부 확인
    const useLocalLLM = API_CONFIG.LOCAL_LLM.ENABLED;
    const endpoint = useLocalLLM ? API_CONFIG.LOCAL_LLM.ENDPOINT : API_CONFIG.OPENAI.ENDPOINT;

    // 사용자 지정 모델이 있으면 우선 사용, 없으면 localStorage에서 확인, 없으면 기본값
    let model;
    if (customModel) {
      model = customModel;
    } else if (useLocalLLM) {
      // localStorage에서 선택한 모델 확인
      const savedModel = localStorage.getItem('selectedOllamaModel');
      model = savedModel || API_CONFIG.LOCAL_LLM.MODEL;
    } else {
      model = API_CONFIG.OPENAI.MODEL;
    }

    const apiKey = useLocalLLM ? API_CONFIG.LOCAL_LLM.API_KEY : API_CONFIG.OPENAI.API_KEY;

    // OpenAI API 사용 시 API 키 필수
    if (!useLocalLLM && !apiKey) {
      const errorMsg = 'OpenAI API 키가 설정되지 않았습니다. 환경 변수 REACT_APP_OPENAI_API_KEY를 설정하거나, 로컬 LLM을 사용하려면 REACT_APP_USE_LOCAL_LLM=true를 설정해주세요.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!endpoint) {
      const errorMsg = 'API 엔드포인트가 설정되지 않았습니다.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    console.log(`${useLocalLLM ? '로컬 LLM' : 'OpenAI'} API 호출 시작:`, {
      endpoint: endpoint,
      model: model,
      useLocalLLM: useLocalLLM,
      hasApiKey: !!apiKey
    });

    const headers = {
      'Content-Type': 'application/json'
    };

    // 로컬 LLM은 API 키가 필요 없지만, OpenAI는 필요
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // API 요청 본문 구성
    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: 3000,
      temperature: 0.8 // 더 창의적인 응답을 위해 온도 상승
    };

    // OpenAI는 추가 파라미터 지원, Ollama는 기본 파라미터만 사용
    if (!useLocalLLM) {
      requestBody.top_p = 0.9;
      requestBody.frequency_penalty = 0.5; // 반복 방지
      requestBody.presence_penalty = 0.3; // 중복 방지
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    console.log('API 응답 상태:', response.status);

    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
        const errorJson = JSON.parse(errorText);
        console.error(`${useLocalLLM ? '로컬 LLM' : 'OpenAI'} API 오류 응답:`, errorJson);
        throw new Error(`API 호출 실패 (${response.status}): ${errorJson.error?.message || errorText}`);
      } catch (parseError) {
        errorText = await response.text().catch(() => '응답을 읽을 수 없습니다.');
        console.error(`${useLocalLLM ? '로컬 LLM' : 'OpenAI'} API 오류 응답 (텍스트):`, errorText);
        throw new Error(`API 호출 실패 (${response.status}): ${errorText}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      console.error('잘못된 응답 형식:', contentType, errorText);
      throw new Error(`잘못된 응답 형식: ${contentType}`);
    }

    const result = await response.json();
    console.log('API 응답 데이터:', result);

    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('예상치 못한 API 응답 형식:', result);
      throw new Error('API 응답 형식이 올바르지 않습니다.');
    }

    return result.choices[0].message.content;
  } catch (error) {
    const useLocalLLM = API_CONFIG.LOCAL_LLM.ENABLED;
    console.error(`${useLocalLLM ? '로컬 LLM' : 'OpenAI'} API 호출 중 오류:`, {
      message: error.message,
      stack: error.stack,
      error: error
    });

    // 에러 메시지가 없으면 기본 메시지 사용
    const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
    throw new Error(errorMessage);
  }
};

/**
 * 통계 데이터를 AI 분석용 JSON 형식으로 변환
 */
export const prepareAnalysisData = (analysisData) => {
  return {
    summary: {
      totalCount: analysisData.totalCount,
      completedCount: analysisData.completedCount,
      uniqueSymptoms: analysisData.uniqueSymptoms,
      uniqueSolutions: analysisData.uniqueSolutions
    },
    topSymptoms: (analysisData.symptomStats || []).slice(0, 10).map(s => ({
      symptom: s.text || s.symptom || String(s),
      count: s.count || 0,
      percentage: analysisData.totalCount > 0 ? ((s.count / analysisData.totalCount) * 100).toFixed(1) : '0.0'
    })),
    topSolutions: (analysisData.solutionStats || []).slice(0, 10).map(s => ({
      solution: s.text || s.solution || String(s),
      count: s.count || 0,
      percentage: analysisData.completedCount > 0 ? ((s.count / analysisData.completedCount) * 100).toFixed(1) : '0.0'
    })),
    topProducts: (analysisData.productStats || []).slice(0, 10).map(p => ({
      product: p.product || String(p),
      count: p.count || 0,
      percentage: analysisData.totalCount > 0 ? ((p.count / analysisData.totalCount) * 100).toFixed(1) : '0.0'
    })),
    topParts: (analysisData.partsStats || []).slice(0, 10).map(p => ({
      part: p.part || String(p),
      count: p.count || 0
    })),
    topTags: (analysisData.tagStats || []).slice(0, 10).map(t => ({
      tag: t.tag || String(t),
      count: t.count || 0,
      percentage: analysisData.totalCount > 0 ? ((t.count / analysisData.totalCount) * 100).toFixed(1) : '0.0'
    })),
    mileageDistribution: (analysisData.mileageStats || []).map(m => ({
      range: m.range || String(m),
      count: m.count || 0,
      percentage: analysisData.totalCount > 0 ? ((m.count / analysisData.totalCount) * 100).toFixed(1) : '0.0'
    }))
  };
};

/**
 * AI 인사이트 생성
 */
export const generateAIInsights = async (analysisData) => {
  const data = prepareAnalysisData(analysisData);

  const systemPrompt = `당신은 A/S 서비스 데이터 분석 전문가입니다. 제공된 통계 데이터를 분석하여 주요 인사이트, 패턴, 트렌드, 그리고 개선 권장사항을 제시해주세요. 
응답은 한국어로 작성하고, 구체적이고 실행 가능한 권장사항을 포함해주세요.
중요: 각 섹션의 내용은 중복되지 않도록 서로 다른 관점에서 작성해주세요. 같은 내용을 반복하지 마세요.`;

  // 데이터 요약 생성
  const completionRate = data.summary.totalCount > 0
    ? ((data.summary.completedCount / data.summary.totalCount) * 100).toFixed(1)
    : '0';

  const topSymptomText = data.topSymptoms.length > 0
    ? data.topSymptoms.slice(0, 5).map(s => `- ${s.symptom} (${s.count}건, ${s.percentage}%)`).join('\n')
    : '데이터 없음';

  const topSolutionText = data.topSolutions.length > 0
    ? data.topSolutions.slice(0, 5).map(s => `- ${s.solution} (${s.count}건, ${s.percentage}%)`).join('\n')
    : '데이터 없음';

  const topProductText = data.topProducts.length > 0
    ? data.topProducts.slice(0, 5).map(p => `- ${p.product} (${p.count}건, ${p.percentage}%)`).join('\n')
    : '데이터 없음';

  const topPartText = data.topParts.length > 0
    ? data.topParts.slice(0, 5).map(p => `- ${p.part} (${p.count}회 사용)`).join('\n')
    : '데이터 없음';

  const prompt = `다음은 A/S 서비스 통계 데이터입니다:

**전체 요약:**
- 총 접수 건수: ${data.summary.totalCount}건
- 완료 건수: ${data.summary.completedCount}건 (완료율: ${completionRate}%)
- 고유 접수 내용: ${data.summary.uniqueSymptoms}개
- 고유 해결 방법: ${data.summary.uniqueSolutions}개

**상위 5개 접수 내용:**
${topSymptomText}

**상위 5개 해결 방법:**
${topSolutionText}

**상위 5개 기종:**
${topProductText}

**상위 5개 부품:**
${topPartText}

이 데이터를 분석하여 다음 형식으로 응답해주세요. 각 섹션은 서로 다른 관점에서 작성하고, 중복되는 내용을 피해주세요:

## 1. 주요 인사이트 (3-5개)
- 각 인사이트는 서로 다른 측면을 다루어야 합니다
- 구체적인 숫자와 비율을 포함해주세요

## 2. 패턴 분석 (2-3개)
- 접수 내용과 해결 방법 간의 관계를 분석해주세요
- 기종별, 부품별 패턴을 분석해주세요

## 3. 트렌드 분석 (2-3개)
- 시간에 따른 변화나 특정 기종/부품의 특징을 분석해주세요
- 거리별 분포나 태그 정보를 활용해주세요

## 4. 개선 권장사항 (3-5개)
- 각 권장사항은 서로 다른 영역을 다루어야 합니다
- 구체적이고 실행 가능한 제안을 해주세요

중요: 같은 내용을 여러 섹션에서 반복하지 마세요. 각 섹션은 고유한 가치를 제공해야 합니다.`;

  try {
    const response = await callOpenAI(prompt, systemPrompt);
    return response;
  } catch (error) {
    throw new Error(`AI 인사이트 생성 실패: ${error.message}`);
  }
};

/**
 * AI 기반 기종/문의/해결 정규화
 */
/**
 * AI 기반 기종/문의/해결 정규화 (고유값 기반)
 */
export const aiNormalizeServiceData = async (services, options = {}) => {
  // 1. 고유값 추출
  const uniqueProducts = new Set();
  const uniqueSymptoms = new Set();
  const uniqueSolutions = new Set();

  services.forEach(s => {
    if (s.product_name && s.product_name.trim()) uniqueProducts.add(s.product_name.trim());
    if (s.symptom && s.symptom.trim()) uniqueSymptoms.add(s.symptom.trim());
    if (s.solution && s.solution.trim()) uniqueSolutions.add(s.solution.trim());
  });

  // 2. 분석할 데이터 준비 (토큰 제한 고려하여 최대 개수 제한)
  // 실제로는 너무 많으면 청크로 나눠야 하지만, 여기서는 상위 빈도수 위주로 하거나 일단 전체를 보냄 (최대 300개 정도면 충분할 수 있음)
  const productsList = Array.from(uniqueProducts).slice(0, 100);
  const symptomsList = Array.from(uniqueSymptoms).slice(0, 100);
  const solutionsList = Array.from(uniqueSolutions).slice(0, 100);

  // 빈 데이터면 처리 안함
  if (productsList.length === 0 && symptomsList.length === 0 && solutionsList.length === 0) {
    return { productMap: {}, symptomMap: {}, solutionMap: {} };
  }

  const systemPrompt = `당신은 A/S 서비스 데이터를 정규화하는 데이터 분석 어시스턴트입니다.
제공된 원본 텍스트 목록(기종, 문의내용, 해결방법)을 분석하여 표준화된 라벨로 매핑해주세요.

규칙:
1. 기종 (Product): 대소문자 통일, 공백 제거, 동일 모델의 다양한 표기를 하나로 통일 (예: "X 200", "x200", "X-200" -> "X200")
2. 문의내용 (Symptom): 핵심 문제 원인이나 증상으로 요약 (예: "앞바퀴에서 소리가 나요" -> "바퀴 소음")
3. 해결방법 (Solution): 수행한 작업의 핵심 내용을 요약 (예: "타이어 튜브 교체해드렸습니다" -> "튜브 교체")

중요: 출력은 반드시 원본 텍스트와 정규화된 텍스트를 매핑한 JSON 객체 형태여야 합니다.
형식: 
{
  "products": { "원본1": "정규화1", ... },
  "symptoms": { "원본1": "정규화1", ... },
  "solutions": { "원본1": "정규화1", ... }
}
`;

  const prompt = `다음 데이터를 정규화해주세요.
JSON 형식으로 응답해주세요. 설명은 필요 없습니다.

**기종 목록:**
${JSON.stringify(productsList)}

**문의내용 목록:**
${JSON.stringify(symptomsList)}

**해결방법 목록:**
${JSON.stringify(solutionsList)}
`;

  try {
    const response = await callOpenAI(prompt, systemPrompt, options.model);

    // JSON 파싱 시도
    let jsonText = response;
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      jsonText = response.slice(start, end + 1);
    }

    const parsed = JSON.parse(jsonText);

    return {
      productMap: parsed.products || {},
      symptomMap: parsed.symptoms || {},
      solutionMap: parsed.solutions || {}
    };

  } catch (error) {
    console.error('AI 정규화 실패:', error);
    // 실패 시 빈 맵 반환 (원본 사용됨)
    return { productMap: {}, symptomMap: {}, solutionMap: {} };
  }
};

/**
 * 자연어 질의 처리
 */
export const processNaturalLanguageQuery = async (query, analysisData) => {
  const data = prepareAnalysisData(analysisData);

  const systemPrompt = `당신은 A/S 서비스 데이터 분석 어시스턴트입니다. 사용자의 질문에 대해 제공된 데이터를 기반으로 정확하고 구체적인 답변을 제공해주세요.
데이터에 없는 정보는 추측하지 말고, "데이터에 해당 정보가 없습니다"라고 답변해주세요.`;

  const prompt = `다음은 A/S 서비스 통계 데이터입니다:

${JSON.stringify(data, null, 2)}

사용자 질문: "${query}"

위 데이터를 기반으로 사용자의 질문에 대해 구체적이고 정확하게 답변해주세요. 숫자와 통계를 포함하여 답변해주세요.`;

  try {
    const response = await callOpenAI(prompt, systemPrompt);
    return response;
  } catch (error) {
    throw new Error(`질의 처리 실패: ${error.message}`);
  }
};

/**
 * 자동 리포트 생성
 */
export const generateAutoReport = async (analysisData, filters) => {
  const data = prepareAnalysisData(analysisData);

  const systemPrompt = `당신은 A/S 서비스 데이터 분석 리포트 작성 전문가입니다. 제공된 데이터를 기반으로 전문적이고 구조화된 리포트를 작성해주세요.`;

  const filterInfo = `
**분석 조건:**
- 브랜드: ${filters.brand || '전체'}
- 기간: ${filters.startDate || ''} ~ ${filters.endDate || ''}
- 완료 건만: ${filters.completedOnly ? '예' : '아니오'}
`;

  const prompt = `${filterInfo}

**통계 데이터:**

${JSON.stringify(data, null, 2)}

위 데이터를 기반으로 다음 형식의 리포트를 작성해주세요:

# A/S 서비스 분석 리포트

## 1. 실행 요약
(전체적인 요약 및 주요 지표)

## 2. 주요 통계
(접수, 완료, 기종, 부품 등 주요 통계)

## 3. 주요 인사이트
(데이터에서 발견된 주요 인사이트 3-5개)

## 4. 패턴 분석
(발견된 패턴 및 트렌드)

## 5. 개선 권장사항
(구체적이고 실행 가능한 권장사항 3-5개)

## 6. 결론
(전체 요약 및 다음 단계)

각 섹션은 구체적이고 전문적으로 작성해주세요.`;

  try {
    const response = await callOpenAI(prompt, systemPrompt);
    return response;
  } catch (error) {
    throw new Error(`리포트 생성 실패: ${error.message}`);
  }
};

/**
 * 이상 패턴 탐지
 */
export const detectAnomalies = (analysisData) => {
  const anomalies = [];

  // 완료율이 낮은 경우 (50% 미만)
  const completionRate = (analysisData.completedCount / analysisData.totalCount) * 100;
  if (completionRate < 50) {
    anomalies.push({
      type: 'low_completion_rate',
      severity: 'high',
      title: '낮은 완료율',
      description: `전체 완료율이 ${completionRate.toFixed(1)}%로 낮습니다. 접수 처리 프로세스를 검토해야 합니다.`,
      recommendation: '접수 처리 프로세스 개선 및 완료율 향상 방안 수립 필요'
    });
  }

  // 특정 접수 내용이 과도하게 많은 경우 (전체의 20% 이상)
  if (analysisData.symptomStats.length > 0) {
    const topSymptom = analysisData.symptomStats[0];
    const topSymptomPercentage = (topSymptom.count / analysisData.totalCount) * 100;
    if (topSymptomPercentage > 20) {
      anomalies.push({
        type: 'dominant_symptom',
        severity: 'medium',
        title: '특정 접수 내용 집중',
        description: `"${topSymptom.text}" 접수 내용이 전체의 ${topSymptomPercentage.toFixed(1)}%를 차지합니다.`,
        recommendation: '해당 접수 내용에 대한 근본 원인 분석 및 예방 조치 필요'
      });
    }
  }

  // 특정 기종의 접수가 과도하게 많은 경우
  if (analysisData.productStats.length > 0) {
    const topProduct = analysisData.productStats[0];
    const topProductPercentage = (topProduct.count / analysisData.totalCount) * 100;
    if (topProductPercentage > 40) {
      anomalies.push({
        type: 'dominant_product',
        severity: 'medium',
        title: '특정 기종 집중',
        description: `"${topProduct.product}" 기종이 전체 접수의 ${topProductPercentage.toFixed(1)}%를 차지합니다.`,
        recommendation: '해당 기종의 품질 검토 및 개선 방안 검토 필요'
      });
    }
  }

  // 부품 사용이 집중된 경우
  if (analysisData.partsStats.length > 0) {
    const topPart = analysisData.partsStats[0];
    const totalPartsUsage = analysisData.partsStats.reduce((sum, p) => sum + p.count, 0);
    if (totalPartsUsage > 0) {
      const topPartPercentage = (topPart.count / totalPartsUsage) * 100;
      if (topPartPercentage > 30) {
        anomalies.push({
          type: 'dominant_part',
          severity: 'low',
          title: '특정 부품 집중 사용',
          description: `"${topPart.part}" 부품이 전체 부품 사용의 ${topPartPercentage.toFixed(1)}%를 차지합니다.`,
          recommendation: '해당 부품의 재고 관리 및 공급 체계 점검 필요'
        });
      }
    }
  }

  // 고유 접수 내용이 과도하게 많은 경우 (접수 건수 대비)
  const symptomRatio = analysisData.uniqueSymptoms / analysisData.totalCount;
  if (symptomRatio > 0.8) {
    anomalies.push({
      type: 'high_symptom_diversity',
      severity: 'low',
      title: '접수 내용 다양성 높음',
      description: `고유 접수 내용이 전체 접수 건수의 ${(symptomRatio * 100).toFixed(1)}%를 차지합니다.`,
      recommendation: '접수 내용 표준화 및 분류 체계 개선 검토'
    });
  }

  return anomalies;
};

/**
 * 이상 패턴에 대한 AI 분석
 */
export const analyzeAnomalies = async (anomalies, analysisData) => {
  if (anomalies.length === 0) {
    return '이상 패턴이 감지되지 않았습니다. 데이터가 정상적으로 보입니다.';
  }

  const data = prepareAnalysisData(analysisData);

  const systemPrompt = `당신은 A/S 서비스 데이터 분석 전문가입니다. 감지된 이상 패턴을 분석하고 심층적인 인사이트를 제공해주세요.`;

  const prompt = `다음은 A/S 서비스 통계 데이터와 감지된 이상 패턴입니다:

**통계 데이터:**
${JSON.stringify(data, null, 2)}

**감지된 이상 패턴:**
${JSON.stringify(anomalies, null, 2)}

위 이상 패턴들을 분석하여 다음을 제공해주세요:

1. **각 이상 패턴의 심층 분석** (원인 분석 포함)
2. **패턴 간의 연관성** (여러 패턴이 있다면)
3. **구체적인 개선 방안** (각 패턴별)
4. **우선순위 권장사항**

구체적이고 실행 가능한 내용으로 작성해주세요.`;

  try {
    const response = await callOpenAI(prompt, systemPrompt);
    return response;
  } catch (error) {
    throw new Error(`이상 패턴 분석 실패: ${error.message}`);
  }
};

// 증상 키워드 ↔ 처리내역 상관관계 AI 분석
export const generateCorrelationInsights = async (keywordCorrelationData) => {
  if (!keywordCorrelationData || keywordCorrelationData.length === 0) {
    throw new Error('분석할 상관관계 데이터가 없습니다.');
  }

  const systemPrompt = `당신은 A/S 서비스 데이터 분석 전문가입니다. 증상 키워드별 처리내역 패턴을 분석하여 실무에 유용한 인사이트를 제공해주세요. 한국어로 작성하세요.`;

  const tableText = keywordCorrelationData
    .slice(0, 12)
    .map(row => {
      const solText = row.topSolutions.map(s => `"${s.solution}"(${s.count}건)`).join(', ');
      return `- [${row.keyword}] ${row.count}건 → ${solText}`;
    })
    .join('\n');

  const prompt = `다음은 A/S 접수 데이터에서 증상 키워드별 주요 처리내역을 집계한 결과입니다:

${tableText}

이 데이터를 바탕으로 다음을 작성해주세요:

## 1. 반복 패턴 요약 (3-5개)
- 자주 발생하는 증상-처리 패턴을 구체적으로 설명해주세요

## 2. 예방·운영 권고사항 (3-5개)
- 반복 접수를 줄이거나 처리를 표준화할 수 있는 실행 가능한 방법

## 3. 처리 표준화 제안
- 같은 증상에 처리내역이 여러 개로 분산된 경우, 통일할 만한 표준 처리 문구 제안`;

  try {
    return await callOpenAI(prompt, systemPrompt);
  } catch (error) {
    throw new Error(`상관관계 분석 실패: ${error.message}`);
  }
};
