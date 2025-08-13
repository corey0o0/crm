import ExcelJS from 'exceljs';

/**
 * Excel 파일을 생성하고 다운로드하는 유틸리티 함수
 * @param {Array} data - 엑셀에 저장할 데이터 배열
 * @param {Array} headers - 헤더 정보 (한글명과 영문키 매핑)
 * @param {string} filename - 파일명
 */
export const downloadExcel = async (data, headers, filename) => {
  try {
    // 새 워크북 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('데이터');

    // 헤더 설정
    const headerRow = headers.map(header => 
      typeof header === 'string' ? header : header.label
    );
    worksheet.addRow(headerRow);

    // 헤더 스타일 적용
    const headerRowObj = worksheet.getRow(1);
    headerRowObj.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 데이터 추가
    data.forEach(item => {
      const row = headers.map(header => {
        const key = typeof header === 'string' ? header : header.key;
        let value = item[key];
        
        // 날짜 포맷팅
        if (value && typeof value === 'string' && value.includes('T')) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              value = date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR');
            }
          } catch (e) {
            // 날짜 변환 실패 시 원본 값 유지
          }
        }
        
        return value || '';
      });
      worksheet.addRow(row);
    });

    // 컬럼 너비 자동 조정
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    // 데이터 셀에 테두리 추가
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // 헤더 제외
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // 파일 다운로드
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Excel 파일 생성 중 오류:', error);
    throw error;
  }
};

/**
 * Excel 파일을 읽어서 JSON 데이터로 변환
 * @param {File} file - 업로드된 Excel 파일
 * @param {Object} options - 파싱 옵션
 * @returns {Array} JSON 데이터 배열
 */
export const readExcelFile = async (file, options = {}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // ArrayBuffer로 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    // 첫 번째 워크시트 가져오기 (또는 지정된 시트)
    const worksheet = options.sheetName 
      ? workbook.getWorksheet(options.sheetName)
      : workbook.getWorksheet(1);
    
    if (!worksheet) {
      throw new Error('워크시트를 찾을 수 없습니다.');
    }

    const jsonData = [];
    const headers = [];
    
    // 헤더 행 처리 (기본적으로 첫 번째 행)
    const headerRowNumber = options.headerRow || 1;
    const headerRow = worksheet.getRow(headerRowNumber);
    
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? cell.value.toString().trim() : `Column${colNumber}`;
    });

    // 데이터 행 처리
    const startRow = headerRowNumber + 1;
    const endRow = worksheet.rowCount;
    
    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowData = {};
      let hasData = false;
      
      row.eachCell((cell, colNumber) => {
        if (headers[colNumber]) {
          let value = cell.value;
          
          // 날짜 처리
          if (value instanceof Date) {
            value = value.toISOString().split('T')[0];
          } else if (value && typeof value === 'object' && value.formula) {
            value = value.result || '';
          } else if (value !== null && value !== undefined) {
            value = value.toString().trim();
          } else {
            value = '';
          }
          
          rowData[headers[colNumber]] = value;
          if (value !== '') hasData = true;
        }
      });
      
      // 빈 행이 아닌 경우에만 추가
      if (hasData) {
        jsonData.push(rowData);
      }
    }
    
    return jsonData;
  } catch (error) {
    console.error('Excel 파일 읽기 중 오류:', error);
    throw error;
  }
};

/**
 * XLSX 호환성을 위한 레거시 함수들
 * 기존 코드의 수정을 최소화하기 위해 제공
 */

// XLSX.utils.json_to_sheet 대체
export const jsonToSheet = (data) => {
  // ExcelJS는 직접 워크시트를 생성하므로 데이터만 반환
  return data;
};

// XLSX.utils.sheet_to_json 대체
export const sheetToJson = async (file, options = {}) => {
  return readExcelFile(file, options);
};

// XLSX.writeFile 대체
export const writeFile = async (data, filename, headers = null) => {
  // headers가 없으면 데이터의 첫 번째 객체에서 키를 추출
  const finalHeaders = headers || (data.length > 0 ? Object.keys(data[0]) : []);
  return downloadExcel(data, finalHeaders, filename.replace('.xlsx', ''));
};

// XLSX.read 대체
export const read = async (file, options = {}) => {
  return {
    SheetNames: ['Sheet1'],
    Sheets: {
      Sheet1: await readExcelFile(file, options)
    }
  };
};

export default {
  downloadExcel,
  readExcelFile,
  jsonToSheet,
  sheetToJson,
  writeFile,
  read
};