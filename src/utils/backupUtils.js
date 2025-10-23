import { supabase } from '../lib/supabaseClient';

/**
 * 전체 데이터베이스 백업 생성
 */
export const createBackup = async () => {
  try {
    console.log('데이터 백업 시작...');
    
    // 백업할 테이블 목록
    const tables = [
      'services',
      'service_tags', 
      'service_parts',
      'shipments',
      'parts',
      'warehouses',
      'dealers',
      'transactions',
      'inventory',
      'model_settings',
      'brand_settings',
      'user_memos',
      'board_posts'
    ];

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
 */
export const restoreBackup = async (backupData, options = {}) => {
  try {
    console.log('데이터 복원 시작...', options);
    
    const { 
      clearExisting = false,  // 기존 데이터 삭제 여부
      skipErrors = true,      // 오류 발생 시 건너뛰기 여부
      tables = null          // 특정 테이블만 복원
    } = options;

    const tablesToRestore = tables || Object.keys(backupData.tables);
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    // 기존 데이터 삭제 (옵션에 따라)
    if (clearExisting) {
      console.log('기존 데이터 삭제 중...');
      for (const table of tablesToRestore) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', 0); // 모든 데이터 삭제
          
          if (error) {
            console.warn(`테이블 ${table} 데이터 삭제 실패:`, error);
          }
        } catch (err) {
          console.warn(`테이블 ${table} 데이터 삭제 중 오류:`, err);
        }
      }
    }

    // 백업 데이터 복원
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
    return results;

  } catch (error) {
    console.error('복원 중 오류:', error);
    throw error;
  }
};

/**
 * 백업 파일 유효성 검사
 */
export const validateBackup = (backupData) => {
  const errors = [];
  
  if (!backupData.timestamp) {
    errors.push('백업 타임스탬프가 없습니다.');
  }
  
  if (!backupData.tables || typeof backupData.tables !== 'object') {
    errors.push('테이블 데이터가 없습니다.');
  }
  
  if (!backupData.version) {
    errors.push('백업 버전 정보가 없습니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
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
