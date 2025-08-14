import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  ElectricBike as BikeIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

function XRiderManual() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [tempSettings, setTempSettings] = useState({});
  const [originalSettings, setOriginalSettings] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [newParameter, setNewParameter] = useState({ param: '', value: '', description: '' });
  const [showAddParameter, setShowAddParameter] = useState(false);

  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: 'info' });
  };

  // 편집 모드 시작
  const startEdit = (modelIndex) => {
    const model = modelSettings[modelIndex];
    setEditingModel(modelIndex);
    setOriginalSettings({ ...model.parameters });
    setTempSettings({ ...model.parameters });
    setEditMode(true);
    showSnackbar('편집 모드가 시작되었습니다', 'info');
  };

  // 편집 취소
  const cancelEdit = () => {
    setConfirmDialog({
      open: true,
      action: 'cancel',
      title: '편집 취소',
      message: '변경사항이 모두 사라집니다. 정말 취소하시겠습니까?'
    });
  };

  // 설정값 저장
  const saveSettings = () => {
    setConfirmDialog({
      open: true,
      action: 'save',
      title: '설정값 저장',
      message: '변경된 설정값을 저장하시겠습니까? 잘못된 설정은 기체 고장의 원인이 될 수 있습니다.'
    });
  };

  // 기본값 복원
  const restoreDefaults = () => {
    setConfirmDialog({
      open: true,
      action: 'restore',
      title: '기본값 복원',
      message: '모든 설정값을 기본값으로 복원하시겠습니까?'
    });
  };

  // 파라미터 값 변경
  const handleParameterChange = (param, value) => {
    // P05는 문자열 값이므로 특별 처리
    if (param === 'P05') {
      setTempSettings(prev => ({
        ...prev,
        [param]: value
      }));
    } else {
      const numValue = parseInt(value) || 0;
      setTempSettings(prev => ({
        ...prev,
        [param]: numValue
      }));
    }
  };

  // 새 파라미터 추가
  const addParameter = () => {
    if (!newParameter.param || !newParameter.value) {
      showSnackbar('파라미터 이름과 값을 모두 입력해주세요.', 'warning');
      return;
    }

    if (tempSettings[newParameter.param]) {
      showSnackbar('이미 존재하는 파라미터입니다.', 'warning');
      return;
    }

    // 새 파라미터를 tempSettings에 추가
    setTempSettings(prev => ({
      ...prev,
      [newParameter.param]: newParameter.param === 'P05' ? newParameter.value : parseInt(newParameter.value) || 0
    }));

    // 설명 추가 (필요시)
    if (newParameter.description) {
      setParameterDescriptions(prev => ({
        ...prev,
        [newParameter.param]: newParameter.description
      }));
    }

    setNewParameter({ param: '', value: '', description: '' });
    setShowAddParameter(false);
    showSnackbar('새 파라미터가 추가되었습니다.', 'success');
  };

  // 파라미터 삭제
  const deleteParameter = (paramToDelete) => {
    setTempSettings(prev => {
      const newSettings = { ...prev };
      delete newSettings[paramToDelete];
      return newSettings;
    });
    showSnackbar(`${paramToDelete} 파라미터가 삭제되었습니다.`, 'info');
  };

  // 확인 대화상자 처리
  const handleConfirmAction = () => {
    const { action } = confirmDialog;
    
    if (action === 'save') {
      try {
        // 실제로는 여기서 서버에 저장하거나 로컬 스토리지에 저장
        modelSettings[editingModel].parameters = { ...tempSettings };
        setEditMode(false);
        setEditingModel(null);
        showSnackbar('저장 성공', 'success');
      } catch (error) {
        showSnackbar('저장 실패', 'error');
      }
    } else if (action === 'cancel') {
      setTempSettings({ ...originalSettings });
      setEditMode(false);
      setEditingModel(null);
      showSnackbar('편집이 취소되었습니다', 'info');
    } else if (action === 'restore') {
      setTempSettings({ ...originalSettings });
      showSnackbar('기본값으로 복원되었습니다', 'info');
    }
    
    setConfirmDialog({ open: false, action: null });
  };

  // 표준 파라미터 설정값 (모든 모델 공통)
  const standardParameters = {
    P00: 2, P01: 48, P02: 22, P03: 100, P04: 1, P05: '누적거리 (Odometer)',
    P06: 0, P07: 2, P08: 0, P10: 25, P11: 12,
    P12: 3, P13: 22, P14: 0, P15: 12, P16: 0
  };

  // X-Rider 모델별 디스플레이 쓰로틀 세팅값
  const modelSettings = [
    {
      model: 'X200 맥스/X100 맥스/X200 프로',
      series: 'X200',
      parameters: { ...standardParameters }
    },
    {
      model: 'Turbo Pro',
      series: 'Turbo',
      parameters: { ...standardParameters }
    },
    {
      model: 'Mini Max',
      series: 'Mini',
      parameters: { ...standardParameters }
    },
    {
      model: 'Mini Pro',
      series: 'Mini',
      parameters: { ...standardParameters }
    },
    {
      model: 'Mini E',
      series: 'Mini',
      parameters: { ...standardParameters }
    },
    {
      model: 'X50',
      series: 'X50',
      parameters: { ...standardParameters }
    },
    {
      model: 'Cafe',
      series: 'Cafe',
      parameters: { ...standardParameters }
    },
    {
      model: 'X200/New X100',
      series: 'X200',
      parameters: { ...standardParameters }
    },
    {
      model: 'X200S/X200 고급형',
      series: 'X200',
      parameters: {
        ...standardParameters,
        P13: 35  // 고급형만 P13이 35로 다름
      }
    }
  ];

  // 시리즈별 모델 그룹화
  const modelsBySeries = modelSettings.reduce((acc, model) => {
    if (!acc[model.series]) {
      acc[model.series] = [];
    }
    acc[model.series].push(model);
    return acc;
  }, {});

  const seriesList = Object.keys(modelsBySeries);

  // 파라미터 설명 데이터 (state로 관리)
  const [parameterDescriptions, setParameterDescriptions] = useState({
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
  });

  const renderParameterTable = (model, modelIndex) => {
    const isEditing = editMode && editingModel === modelIndex;
    const currentParams = isEditing ? tempSettings : model.parameters;
    
    return (
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>파라미터</strong></TableCell>
              <TableCell><strong>값</strong></TableCell>
              <TableCell><strong>설명</strong></TableCell>
              {isEditing && <TableCell width="100px"><strong>작업</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(currentParams).map(([param, value]) => {
              const hasChanged = isEditing && originalSettings[param] !== value;
              
              return (
                <TableRow key={param}>
                  <TableCell sx={{ fontWeight: 600, width: '15%' }}>{param}</TableCell>
                  <TableCell sx={{ width: '25%' }}>
                    {isEditing ? (
                      <TextField
                        size="small"
                        type={param === 'P05' ? 'text' : 'number'}
                        value={value}
                        onChange={(e) => handleParameterChange(param, e.target.value)}
                        sx={{ 
                          width: param === 'P05' ? 200 : 100,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: hasChanged ? '#fff3cd' : 'transparent',
                            '& fieldset': {
                              borderColor: hasChanged ? '#ffc107' : undefined
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography 
                        variant="body2"
                        sx={{ 
                          fontWeight: hasChanged ? 600 : 400,
                          color: hasChanged ? '#d63384' : 'inherit'
                        }}
                      >
                        {value}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ width: isEditing ? '50%' : '60%' }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: '0.875rem' }}
                    >
                      {parameterDescriptions[param] || '설명 없음'}
                    </Typography>
                  </TableCell>
                  {isEditing && (
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => deleteParameter(param)}
                        color="error"
                        title={`${param} 삭제`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            
            {/* 새 파라미터 추가 행 */}
            {isEditing && showAddParameter && (
              <TableRow>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="P17"
                    value={newParameter.param}
                    onChange={(e) => setNewParameter(prev => ({ ...prev, param: e.target.value }))}
                    sx={{ width: 80 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="값"
                    value={newParameter.value}
                    onChange={(e) => setNewParameter(prev => ({ ...prev, value: e.target.value }))}
                    sx={{ width: 100 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="파라미터 설명"
                    value={newParameter.description}
                    onChange={(e) => setNewParameter(prev => ({ ...prev, description: e.target.value }))}
                    sx={{ width: 200 }}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={addParameter}
                      color="primary"
                      title="추가"
                    >
                      <SaveIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setShowAddParameter(false);
                        setNewParameter({ param: '', value: '', description: '' });
                      }}
                      color="error"
                      title="취소"
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            
            {/* 파라미터 추가 버튼 행 */}
            {isEditing && !showAddParameter && (
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: 'center', py: 1 }}>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setShowAddParameter(true)}
                    variant="outlined"
                    color="primary"
                  >
                    새 파라미터 추가
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderSeriesModels = (series) => {
    const models = modelsBySeries[series];
    return (
      <Box sx={{ mt: 2 }}>
        {models.map((model, index) => {
          const globalIndex = modelSettings.findIndex(m => m.model === model.model);
          const isEditing = editMode && editingModel === globalIndex;
          
          return (
            <Accordion key={index} sx={{ mb: 1 }} disabled={editMode && !isEditing}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <BikeIcon color="primary" />
                  <Typography variant="h6">{model.model}</Typography>
                  <Chip 
                    label={model.series} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                  {isEditing && (
                    <Chip 
                      label="편집 중" 
                      size="small" 
                      color="warning" 
                      sx={{ ml: 'auto' }}
                    />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {model.model} 모델의 디스플레이 쓰로틀 세팅값입니다.
                  </Typography>
                  
                  {!editMode ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => startEdit(globalIndex)}
                    >
                      편집
                    </Button>
                  ) : isEditing ? (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RestoreIcon />}
                        onClick={restoreDefaults}
                      >
                        복원
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={cancelEdit}
                        color="error"
                      >
                        취소
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveIcon />}
                        onClick={saveSettings}
                        color="primary"
                      >
                        저장
                      </Button>
                    </Stack>
                  ) : null}
                </Box>
                
                {isEditing && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      편집 모드입니다. 변경된 값은 노란색으로 표시됩니다. 
                      잘못된 설정은 기체 고장의 원인이 될 수 있으니 주의하세요.
                    </Typography>
                  </Alert>
                )}
                
                {renderParameterTable(model, globalIndex)}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        X-Rider 제품 메뉴얼
      </Typography>

      {/* 안전 경고 */}
      <Alert 
        severity="warning" 
        icon={<WarningIcon />}
        sx={{ mb: 3 }}
      >
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          ⚠️ 중요 안전 주의사항
        </Typography>
        <Typography variant="body2">
          임의의 세팅값 변경은 기체 고장의 원인이 되거나 주행 시 안전 문제를 야기할 수 있습니다.
          반드시 전문 기술자의 지도 하에 설정을 변경하시기 바랍니다.
        </Typography>
      </Alert>

      {/* 개요 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                지원 모델
              </Typography>
              <Typography variant="body2" color="text.secondary">
                총 {modelSettings.length}개 모델의 디스플레이 쓰로틀 세팅값을 제공합니다.
              </Typography>
              <Box sx={{ mt: 2 }}>
                {Object.keys(modelsBySeries).map((series) => (
                  <Chip 
                    key={series}
                    label={`${series} 시리즈`}
                    sx={{ mr: 1, mb: 1 }}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                파라미터 설명
              </Typography>
              <Typography variant="body2" color="text.secondary">
                P01~P30까지 30개의 파라미터를 통해 전동자전거의 성능과 안전을 제어합니다.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                각 모델별로 최적화된 설정값이 적용되어 있습니다.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 시리즈별 탭 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {seriesList.map((series, index) => (
            <Tab 
              key={series} 
              label={`${series} 시리즈`}
              icon={<BikeIcon />}
            />
          ))}
        </Tabs>
      </Paper>

      {/* 선택된 시리즈의 모델들 */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          {seriesList[selectedTab]} 시리즈
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {modelsBySeries[seriesList[selectedTab]]?.length}개 모델의 설정값을 확인할 수 있습니다.
        </Typography>
        {renderSeriesModels(seriesList[selectedTab])}
      </Paper>

      {/* 확인 대화상자 */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, action: null })}
      >
        <DialogTitle>
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setConfirmDialog({ open: false, action: null })}
            color="inherit"
          >
            취소
          </Button>
          <Button 
            onClick={handleConfirmAction}
            color="primary"
            variant="contained"
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default XRiderManual;