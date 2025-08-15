import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';

function NewManual() {
  // 상태 관리
  const [models, setModels] = useState([]);
  const [editingModel, setEditingModel] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [viewingModel, setViewingModel] = useState(null); // 모델 상세 보기 상태 추가
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // 표준 파라미터 설정값
  const standardParameters = {
    P00: 2, P01: 48, P02: 22, P03: 100, P04: 1, P05: '누적거리 (Odometer)',
    P06: 0, P07: 2, P08: 0, P10: 25, P11: 12,
    P12: 3, P13: 22, P14: 0, P15: 12, P16: 0
  };

  // 표준 파라미터 설명
  const standardDescriptions = {
    P00: '전압 설정 (24V/36V/48V)',
    P01: '최대 속도 제한 (km/h)',
    P02: '모터 극수 설정',
    P03: '바퀴 직경 설정 (인치 x 10)',
    P04: '속도 센서 신호 개수',
    P05: '누적 거리 표시 설정',
    P06: '휠 센서 타입',
    P07: '백라이트 밝기 레벨',
    P08: '자동 절전 시간 (분)',
    P09: '속도 제한 모드',
    P10: '전류 제한 (A)',
    P11: '가속 강도 설정',
    P12: '제동 강도 설정',
    P13: '최대 전류 설정 (A)',
    P14: '시동 전류 설정',
    P15: '저전압 보호 설정',
    P16: '온도 보호 설정'
  };

  // 표준 오류코드
  const standardErrorCodes = {
    'E01': '모터 과부하',
    'E02': '배터리 전압 부족',
    'E03': '배터리 전압 과다',
    'E04': '모터 온도 과다',
    'E05': '컨트롤러 온도 과다',
    'E06': '브레이크 오류',
    'E07': '스로틀 오류',
    'E08': '속도 센서 오류',
    'E09': '통신 오류',
    'E10': '시스템 오류'
  };

  // UUID 생성 함수
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Snackbar 표시 함수
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // 데이터 로드
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const { data, error } = await supabase
        .from('model_settings')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // 기존 데이터에 error_codes와 pdf_link가 없는 경우 기본값 설정
        const processedData = data.map(model => ({
          ...model,
          error_codes: model.error_codes || { ...standardErrorCodes },
          pdf_link: model.pdf_link || ''
        }));
        setModels(processedData);
      } else {
        // 자동 기본 데이터 삽입 제거: 비어 있으면 비어 있는 상태로 표시
        setModels([]);
        showSnackbar('모델이 없습니다. "모델 추가"로 새 모델을 생성하세요.', 'info');
      }
    } catch (error) {
      console.error('모델 로드 오류:', error);
      showSnackbar(`모델 로드 실패: ${error.message}`, 'error');
    }
  };

  // 모델 추가
  const handleAddModel = () => {
    const newModel = {
      id: generateUUID(),
      model_name: '새 모델',
      parameters: { ...standardParameters },
      descriptions: { ...standardDescriptions },
      error_codes: { ...standardErrorCodes },
      pdf_link: '',
      order_index: models.length
    };
    setEditingModel(newModel);
    setIsAdding(true);
  };

  // 모델 편집
  const handleEditModel = (model) => {
    setEditingModel({ ...model });
    setIsAdding(false);
  };

  // 모델 상세 보기
  const handleViewModel = (model) => {
    setViewingModel({ ...model });
  };

  // 모델 상세 보기 닫기
  const handleCloseView = () => {
    setViewingModel(null);
  };

  // 모델 삭제
  const handleDeleteModel = async (modelId) => {
    if (window.confirm('이 모델을 삭제하시겠습니까?')) {
      try {
        console.log('모델 삭제 시도:', { modelId });
        const { data: deletedRows, error } = await supabase
          .from('model_settings')
          .delete()
          .eq('id', modelId)
          .select('id');

        if (error) throw error;

        if (!deletedRows || deletedRows.length === 0) {
          console.warn('DB에서 삭제된 행이 없습니다. 조건을 확인하세요.', { modelId });
        }

        // 삭제된 모델이 현재 편집 중인 모델인지 확인
        if (editingModel && editingModel.id === modelId) {
          console.log('편집 중이던 모델이 삭제되었습니다. 편집 상태를 초기화합니다.');
          setEditingModel(null);
          setIsAdding(false);
        }

        setModels(prev => {
          const before = prev.length;
          const next = prev.filter(m => m.id !== modelId);
          const removed = before - next.length;
          console.log('모델 삭제 반영(클라이언트 상태):', { removed, before, after: next.length });
          if (removed === 0) {
            console.warn('클라이언트 상태에서 일치하는 모델을 찾지 못했습니다.', { modelId });
          }
          return next;
        });

        console.log('모델 삭제 완료:', { modelId, deletedCount: deletedRows ? deletedRows.length : 0 });
        // DB와 동기화
        await loadModels();
        showSnackbar('모델이 삭제되었습니다.', 'success');
      } catch (error) {
        console.error('모델 삭제 오류:', error);
        console.error('삭제 오류 상세:', {
          message: error.message,
          code: error.code,
          details: error.details
        });
        showSnackbar(`모델 삭제 실패: ${error.message}`, 'error');
      }
    }
  };

  // 모델 저장
  const handleSaveModel = async () => {
    try {
      // 시리즈, error_codes, pdf_link 필드가 있다면 제거 (임시)
      const { series, error_codes, pdf_link, ...modelToSave } = editingModel;
      console.log('저장할 모델 데이터:', modelToSave);
      
      if (isAdding) {
        const { data, error } = await supabase
          .from('model_settings')
          .insert(modelToSave);

        if (error) {
          console.error('모델 추가 오류 상세:', error);
          console.error('오류 메시지:', error.message);
          console.error('오류 코드:', error.code);
          console.error('오류 상세:', error.details);
          console.error('오류 힌트:', error.hint);
          throw error;
        }

        setModels(prev => [...prev, modelToSave]);
        showSnackbar('새 모델이 추가되었습니다.', 'success');
      } else {
        // 수정 시 모델이 여전히 존재하는지 확인
        const existingModel = models.find(m => m.id === modelToSave.id);
        if (!existingModel) {
          showSnackbar('수정하려는 모델이 존재하지 않습니다. 모델이 삭제되었을 수 있습니다.', 'error');
          setEditingModel(null);
          setIsAdding(false);
          return;
        }

        const { data, error } = await supabase
          .from('model_settings')
          .update(modelToSave)
          .eq('id', modelToSave.id);

        if (error) {
          console.error('모델 수정 오류 상세:', error);
          console.error('오류 메시지:', error.message);
          console.error('오류 코드:', error.code);
          console.error('오류 상세:', error.details);
          console.error('오류 힌트:', error.hint);
          throw error;
        }

        setModels(prev => prev.map(m => m.id === modelToSave.id ? modelToSave : m));
        showSnackbar('모델이 수정되었습니다.', 'success');
      }

      setEditingModel(null);
      setIsAdding(false);
    } catch (error) {
      console.error('모델 저장 오류:', error);
      console.error('오류 상세 정보:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      showSnackbar(`모델 저장 실패: ${error.message}`, 'error');
    }
  };

  // 모델 편집 취소
  const handleCancelEdit = () => {
    setEditingModel(null);
    setIsAdding(false);
  };

  // 파라미터 값 변경
  const handleParameterChange = (param, value) => {
    setEditingModel(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [param]: param === 'P05' || param.startsWith('E') ? value : (value === '' ? 0 : parseInt(value) || 0)
      }
    }));
  };

  // 파라미터 설명 변경
  const handleDescriptionChange = (param, value) => {
    setEditingModel(prev => ({
      ...prev,
      descriptions: {
        ...prev.descriptions,
        [param]: value
      }
    }));
  };

  // 오류코드 설명 변경
  const handleErrorCodeChange = (code, value) => {
    setEditingModel(prev => ({
      ...prev,
      error_codes: {
        ...(prev.error_codes || {}),
        [code]: value
      }
    }));
  };

  // 파라미터 목록
  const parameterKeys = Object.keys(standardParameters);
  // 오류코드 목록
  const errorCodeKeys = Object.keys(standardErrorCodes);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          X-Rider 메뉴얼 관리
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddModel}
        >
          모델 추가
        </Button>
      </Box>

      {/* 모델 목록 테이블 */}
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>순서</TableCell>
              <TableCell>모델명</TableCell>
              <TableCell>파라미터 수</TableCell>
              <TableCell>오류코드 수</TableCell>
              <TableCell>PDF 메뉴얼</TableCell>
              <TableCell>작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map((model, index) => (
              <TableRow key={model.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Button
                    variant="text"
                    onClick={() => handleViewModel(model)}
                    sx={{ 
                      textTransform: 'none', 
                      fontWeight: 'bold',
                      color: 'primary.main',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    {model.model_name}
                  </Button>
                </TableCell>
                <TableCell>{Object.keys(model.parameters || {}).length}</TableCell>
                <TableCell>{Object.keys(model.error_codes || {}).length}</TableCell>
                <TableCell>
                  {model.pdf_link ? (
                    <Button
                      size="small"
                      variant="outlined"
                      component="a"
                      href={model.pdf_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      PDF 보기
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      링크 없음
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleEditModel(model)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteModel(model.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 편집 다이얼로그 */}
      {editingModel && (
        <Dialog 
          open={true} 
          onClose={handleCancelEdit}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            {isAdding ? '새 모델 추가' : '모델 편집'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 3, mt: 2 }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="모델명"
                  value={editingModel.model_name}
                  onChange={(e) => setEditingModel(prev => ({ ...prev, model_name: e.target.value }))}
                  fullWidth
                />
              </Stack>
            </Box>

            {/* PDF 링크 입력 */}
            <Box sx={{ mb: 3 }}>
              <TextField
                label="PDF 메뉴얼 링크"
                value={editingModel.pdf_link || ''}
                onChange={(e) => setEditingModel(prev => ({ ...prev, pdf_link: e.target.value }))}
                fullWidth
                placeholder="https://example.com/manual.pdf"
                helperText="PDF 메뉴얼 파일의 링크를 입력하세요"
              />
            </Box>

            {/* 파라미터 테이블 */}
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>파라미터</TableCell>
                    <TableCell>값</TableCell>
                    <TableCell>설명</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parameterKeys.map(param => (
                    <TableRow key={param}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{param}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type={param === 'P05' || param.startsWith('E') ? 'text' : 'number'}
                          value={editingModel.parameters[param] !== undefined ? editingModel.parameters[param] : ''}
                          onChange={(e) => handleParameterChange(param, e.target.value)}
                          sx={{ width: 120 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={editingModel.descriptions[param] || ''}
                          onChange={(e) => handleDescriptionChange(param, e.target.value)}
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* 오류코드 테이블 */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                오류코드 설정
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>오류코드</TableCell>
                      <TableCell>설명</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {errorCodeKeys.map(code => (
                      <TableRow key={code}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'error.main' }}>{code}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={editingModel.error_codes?.[code] || ''}
                            onChange={(e) => handleErrorCodeChange(code, e.target.value)}
                            fullWidth
                            placeholder="오류 설명을 입력하세요"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelEdit} startIcon={<CancelIcon />}>
              취소
            </Button>
            <Button 
              onClick={handleSaveModel} 
              variant="contained" 
              startIcon={<SaveIcon />}
            >
              저장
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 모델 상세 보기 모달 */}
      {viewingModel && (
        <Dialog 
          open={true} 
          onClose={handleCloseView}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                {viewingModel.model_name} - 상세 정보
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  handleCloseView();
                  handleEditModel(viewingModel);
                }}
                startIcon={<EditIcon />}
              >
                편집
              </Button>
            </Box>
          </DialogTitle>
          <DialogContent>
            {/* 기본 정보 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                기본 정보
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  파라미터: {Object.keys(viewingModel.parameters || {}).length}개
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  오류코드: {Object.keys(viewingModel.error_codes || {}).length}개
                </Typography>
              </Box>
              {viewingModel.pdf_link && (
                <Button
                  variant="contained"
                  component="a"
                  href={viewingModel.pdf_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<PdfIcon />}
                  sx={{ mb: 2 }}
                >
                  PDF 메뉴얼 보기
                </Button>
              )}
            </Box>

            {/* 파라미터 정보 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                파라미터 설정
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>파라미터</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>값</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>설명</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parameterKeys.map(param => (
                      <TableRow key={param}>
                        <TableCell sx={{ fontWeight: 'bold' }}>{param}</TableCell>
                        <TableCell>{viewingModel.parameters?.[param] !== undefined ? viewingModel.parameters[param] : '-'}</TableCell>
                        <TableCell>{viewingModel.descriptions?.[param] || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 오류코드 정보 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'error.main' }}>
                오류코드
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>오류코드</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>설명</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {errorCodeKeys.map(code => (
                      <TableRow key={code}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'error.main' }}>{code}</TableCell>
                        <TableCell>{viewingModel.error_codes?.[code] || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseView}>
              닫기
            </Button>
            <Button 
              variant="contained"
              onClick={() => {
                handleCloseView();
                handleEditModel(viewingModel);
              }}
              startIcon={<EditIcon />}
            >
              편집하기
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default NewManual;
