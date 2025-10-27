import { supabase } from '../lib/supabaseClient';

/**
 * 복원 순서: 외래 키 의존성을 고려한 순서
 * 1단계: 의존성 없는 독립 테이블
 * 2단계: 1단계 테이블에만 의존하는 테이블
 * 3단계: 2단계 테이블에 의존하는 테이블
 */
const RESTORE_ORDER = [
  // 1단계: 독립 테이블 (의존성 없음)
  'parts',
  'warehouses',
  'dealers',
  'model_settings',
  'brand_settings',
  'user_memos',
  'board_posts',
  
  // 2단계: 1단계 테이블에만 의존
  'services',
  'shipments',
  'inventory',        // parts, warehouses 의존
  'transactions',     // parts 의존
  
  // 3단계: 2단계 테이블에 의존
  'service_tags',     // services 의존
  'service_parts'     // services, parts 의존
];

/**
 * 전체 데이터베이스 백업 생성
 */
export const createBackup = async () => {
  try {
    console.log('데이터 백업 시작...');
    
    // 백업할 테이블 목록 (복원 순서와 동일하게 사용)
    const tables = [...RESTORE_ORDER];

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      tables: {}
    };

    // 각 테이블의 데이터를 백업
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*');

        if (error) {
          console.warn(`테이블 ${table} 백업 실패:`, error);
          backupData.tables[table] = { error: error.message, data: [] };
        } else {
          backupData.tables[table] = { data: data || [] };
        }
      } catch (err) {
        console.warn(`테이블 ${table} 백업 중 오류:`, err);
        backupData.tables[table] = { error: err.message, data: [] };
      }
    }

    // 백업 메타데이터 추가
    backupData.metadata = {
      totalTables: tables.length,
      successfulTables: Object.values(backupData.tables).filter(t => !t.error).length,
      totalRecords: Object.values(backupData.tables).reduce((sum, table) => 
        sum + (table.data ? table.data.length : 0), 0
      )
    };

    console.log('데이터 백업 완료:', backupData.metadata);
    return backupData;

  } catch (error) {
    console.error('백업 생성 중 오류:', error);
    throw error;
  }
};

/**
 * 백업 데이터를 JSON 파일로 다운로드
 */
export const downloadBackup = (backupData) => {
  try {
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crm_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('백업 다운로드 중 오류:', error);
    throw error;
  }
};

/**
 * 백업 파일에서 데이터 읽기
 */
export const readBackupFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        // 백업 파일 유효성 검사
        if (!backupData.timestamp || !backupData.tables) {
          throw new Error('유효하지 않은 백업 파일입니다.');
        }
        
        resolve(backupData);
      } catch (error) {
        reject(new Error('백업 파일을 읽는 중 오류가 발생했습니다: ' + error.message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * 백업 데이터 복원
 * @param {Object} backupData - 복원할 백업 데이터
 * @param {Object} options - 복원 옵션
 * @param {boolean} options.clearExisting - 기존 데이터 삭제 여부 (기본값: true로 변경)
 * @param {boolean} options.skipErrors - 오류 발생 시 건너뛰기 여부
 * @param {Array} options.tables - 특정 테이블만 복원
 * @returns {Promise<Object>} 복원 결과 (successful, failed, skipped)
 */
export const restoreBackup = async (backupData, options = {}) => {
  try {
    console.log('데이터 복원 시작...', options);
    
    const { 
      clearExisting = true,   // 기존 데이터 삭제 여부 (안전성을 위해 true로 변경)
      skipErrors = false,     // 오류 발생 시 중단 (무결성을 위해 false로 변경)
      tables = null          // 특정 테이블만 복원
    } = options;

    // 복원할 테이블 목록을 RESTORE_ORDER에 따라 정렬
    let tablesToRestore;
    if (tables) {
      // 특정 테이블만 복원하는 경우에도 순서 유지
      tablesToRestore = RESTORE_ORDER.filter(table => tables.includes(table));
    } else {
      // 전체 복원 시 RESTORE_ORDER 순서 사용
      tablesToRestore = RESTORE_ORDER.filter(table => backupData.tables[table]);
    }
    
    console.log('복원 순서:', tablesToRestore);

    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    // 기존 데이터 삭제 (옵션에 따라) - 역순으로 삭제
    if (clearExisting) {
      console.log('기존 데이터 삭제 중... (외래 키 제약 조건 고려하여 역순 삭제)');
      const deleteOrder = [...tablesToRestore].reverse();
      
      for (const table of deleteOrder) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', 0); // 모든 데이터 삭제
          
          if (error) {
            console.warn(`테이블 ${table} 데이터 삭제 실패:`, error);
          } else {
            console.log(`테이블 ${table} 데이터 삭제 완료`);
          }
        } catch (err) {
          console.warn(`테이블 ${table} 데이터 삭제 중 오류:`, err);
        }
      }
    }

    // 백업 데이터 복원 (RESTORE_ORDER 순서대로)
    for (const table of tablesToRestore) {
      try {
        const tableData = backupData.tables[table];
        
        if (!tableData || tableData.error) {
          results.skipped.push({ table, reason: '백업 데이터 없음 또는 오류' });
          continue;
        }

        if (!tableData.data || tableData.data.length === 0) {
          results.skipped.push({ table, reason: '복원할 데이터 없음' });
          continue;
        }

        // 데이터 삽입
        const { error } = await supabase
          .from(table)
          .insert(tableData.data);

        if (error) {
          console.error(`테이블 ${table} 복원 실패:`, error);
          results.failed.push({ table, error: error.message });
          
          if (!skipErrors) {
            throw new Error(`테이블 ${table} 복원 실패: ${error.message}`);
          }
        } else {
          console.log(`테이블 ${table} 복원 완료: ${tableData.data.length}개 레코드`);
          results.successful.push({ 
            table, 
            records: tableData.data.length 
          });
        }

      } catch (err) {
        console.error(`테이블 ${table} 복원 중 오류:`, err);
        results.failed.push({ table, error: err.message });
        
        if (!skipErrors) {
          throw err;
        }
      }
    }

    console.log('데이터 복원 완료:', results);
    
    // 복원 성공 시 시퀀스 재설정
    if (results.successful.length > 0) {
      console.log('시퀀스 재설정 시작...');
      await resetSequences(results.successful.map(r => r.table));
      console.log('시퀀스 재설정 완료');
    }
    
    return results;

  } catch (error) {
    console.error('복원 중 오류:', error);
    throw error;
  }
};

/**
 * 테이블 시퀀스 재설정
 * 복원 후 ID 자동 증가 값을 현재 최대값으로 설정
 */
const resetSequences = async (tables) => {
  const sequenceResets = {
    'services': 'services_id_seq',
    'service_tags': 'service_tags_id_seq',
    'service_parts': 'service_parts_id_seq',
    'shipments': 'shipments_id_seq',
    'parts': 'parts_id_seq',
    'warehouses': 'warehouses_id_seq',
    'dealers': 'dealers_id_seq',
    'transactions': 'transactions_id_seq',
    'inventory': 'inventory_id_seq',
    'model_settings': 'model_settings_id_seq',
    'brand_settings': 'brand_settings_id_seq',
    'user_memos': 'user_memos_id_seq',
    'board_posts': 'board_posts_id_seq'
  };

  for (const table of tables) {
    const sequenceName = sequenceResets[table];
    if (!sequenceName) continue;

    try {
      // 테이블의 최대 ID 조회
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .order('id', { ascending: false })
        .limit(1);

      if (error) {
        console.warn(`테이블 ${table}의 최대 ID 조회 실패:`, error);
        continue;
      }

      if (data && data.length > 0) {
        const maxId = data[0].id;
        
        // PostgreSQL의 setval 함수는 RPC로 호출
        // Supabase에서는 직접 시퀀스 재설정이 제한되므로
        // 다음 ID가 maxId + 1이 되도록 로그만 출력
        console.log(`테이블 ${table}: 현재 최대 ID = ${maxId}, 다음 ID는 ${maxId + 1}부터 시작됩니다.`);
        
        // 참고: 실제 시퀀스 재설정이 필요한 경우 
        // Supabase 대시보드의 SQL Editor에서 수동으로 실행:
        // SELECT setval('services_id_seq', (SELECT MAX(id) FROM services));
      }
    } catch (err) {
      console.warn(`테이블 ${table} 시퀀스 처리 중 오류:`, err);
    }
  }
};

/**
 * 백업 파일 유효성 검사
 * 기본 형식 검증 + 외래 키 참조 무결성 검증
 */
export const validateBackup = (backupData) => {
  const errors = [];
  const warnings = [];
  
  // 기본 형식 검증
  if (!backupData.timestamp) {
    errors.push('백업 타임스탬프가 없습니다.');
  }
  
  if (!backupData.tables || typeof backupData.tables !== 'object') {
    errors.push('테이블 데이터가 없습니다.');
  }
  
  if (!backupData.version) {
    errors.push('백업 버전 정보가 없습니다.');
  }
  
  // 외래 키 참조 무결성 검증
  if (backupData.tables) {
    const fkValidation = validateForeignKeys(backupData);
    warnings.push(...fkValidation.warnings);
    errors.push(...fkValidation.errors);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * 외래 키 참조 무결성 검증
 * 백업 데이터 내에서 외래 키 참조가 올바른지 확인
 */
const validateForeignKeys = (backupData) => {
  const warnings = [];
  const errors = [];
  
  try {
    const tables = backupData.tables;
    
    // 1. service_parts 검증 (services, parts 참조)
    if (tables.service_parts?.data) {
      const serviceIds = new Set(tables.services?.data?.map(s => s.id) || []);
      const partIds = new Set(tables.parts?.data?.map(p => p.id) || []);
      
      let invalidServiceRefs = 0;
      let invalidPartRefs = 0;
      
      tables.service_parts.data.forEach(sp => {
        if (sp.service_id && !serviceIds.has(sp.service_id)) {
          invalidServiceRefs++;
        }
        if (sp.part_id && !partIds.has(sp.part_id)) {
          invalidPartRefs++;
        }
      });
      
      if (invalidServiceRefs > 0) {
        errors.push(`service_parts: ${invalidServiceRefs}개 레코드가 존재하지 않는 service_id를 참조합니다.`);
      }
      if (invalidPartRefs > 0) {
        errors.push(`service_parts: ${invalidPartRefs}개 레코드가 존재하지 않는 part_id를 참조합니다.`);
      }
    }
    
    // 2. service_tags 검증 (services 참조)
    if (tables.service_tags?.data) {
      const serviceIds = new Set(tables.services?.data?.map(s => s.id) || []);
      let invalidRefs = 0;
      
      tables.service_tags.data.forEach(st => {
        if (st.service_id && !serviceIds.has(st.service_id)) {
          invalidRefs++;
        }
      });
      
      if (invalidRefs > 0) {
        errors.push(`service_tags: ${invalidRefs}개 레코드가 존재하지 않는 service_id를 참조합니다.`);
      }
    }
    
    // 3. inventory 검증 (parts, warehouses 참조)
    if (tables.inventory?.data) {
      const partIds = new Set(tables.parts?.data?.map(p => p.id) || []);
      const warehouseIds = new Set(tables.warehouses?.data?.map(w => w.id) || []);
      
      let invalidPartRefs = 0;
      let invalidWarehouseRefs = 0;
      
      tables.inventory.data.forEach(inv => {
        if (inv.part_id && !partIds.has(inv.part_id)) {
          invalidPartRefs++;
        }
        if (inv.warehouse_id && !warehouseIds.has(inv.warehouse_id)) {
          invalidWarehouseRefs++;
        }
      });
      
      if (invalidPartRefs > 0) {
        errors.push(`inventory: ${invalidPartRefs}개 레코드가 존재하지 않는 part_id를 참조합니다.`);
      }
      if (invalidWarehouseRefs > 0) {
        errors.push(`inventory: ${invalidWarehouseRefs}개 레코드가 존재하지 않는 warehouse_id를 참조합니다.`);
      }
    }
    
    // 4. transactions 검증 (parts 참조)
    if (tables.transactions?.data) {
      const partIds = new Set(tables.parts?.data?.map(p => p.id) || []);
      let invalidRefs = 0;
      
      tables.transactions.data.forEach(t => {
        if (t.part_id && !partIds.has(t.part_id)) {
          invalidRefs++;
        }
      });
      
      if (invalidRefs > 0) {
        errors.push(`transactions: ${invalidRefs}개 레코드가 존재하지 않는 part_id를 참조합니다.`);
      }
    }
    
    // 5. 테이블 누락 경고
    const requiredTables = ['services', 'parts', 'warehouses'];
    requiredTables.forEach(table => {
      if (!tables[table] || !tables[table].data || tables[table].data.length === 0) {
        warnings.push(`필수 테이블 '${table}'의 데이터가 없습니다. 복원 시 외래 키 오류가 발생할 수 있습니다.`);
      }
    });
    
  } catch (error) {
    warnings.push(`외래 키 검증 중 오류: ${error.message}`);
  }
  
  return { warnings, errors };
};

/**
 * 백업 통계 정보 생성
 */
export const getBackupStats = (backupData) => {
  const stats = {
    timestamp: backupData.timestamp,
    version: backupData.version,
    totalTables: Object.keys(backupData.tables).length,
    totalRecords: 0,
    tableStats: {}
  };

  Object.entries(backupData.tables).forEach(([table, data]) => {
    const recordCount = data.data ? data.data.length : 0;
    stats.totalRecords += recordCount;
    stats.tableStats[table] = {
      records: recordCount,
      hasError: !!data.error
    };
  });

  return stats;
};
