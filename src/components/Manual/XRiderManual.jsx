import React, { useState, useEffect } from 'react';
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
  Edit as EditIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'; // Drag and Drop 임포트
import { supabase } from '../../lib/supabaseClient'; // Supabase 클라이언트 임포트

function XRiderManual() {
  // 표준 파라미터 설정값 (모든 모델 공통)
  const standardParameters = {
    P00: 2, P01: 48, P02: 22, P03: 100, P04: 1, P05: '누적거리 (Odometer)',
    P06: 0, P07: 2, P08: 0, P10: 25, P11: 12,
    P12: 3, P13: 22, P14: 0, P15: 12, P16: 0
  };

  // 표준 파라미터 설명
  const standardDescriptions = {
    P00: '전압 설정 (24V/36V/36V/48V)',
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

  const [modelSettings, setModelSettings] = useState([]); // modelSettings 상태 추가
  const [selectedTab, setSelectedTab] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [tempSettings, setTempSettings] = useState({});
  const [tempDescriptions, setTempDescriptions] = useState({});
  const [tempModelName, setTempModelName] = useState(''); // 모델명 임시 저장 상태
  const [originalSettings, setOriginalSettings] = useState({});
  const [originalDescriptions, setOriginalDescriptions] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [newParameter, setNewParameter] = useState({ param: '', value: '', description: '' });
  const [showAddParameter, setShowAddParameter] = useState(false);

  // 초기화 함수 추가
  const handleInitialize = async () => {
    try {
      // 모든 데이터 삭제
      const { error } = await supabase
        .from('model_settings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 레코드 삭제

      if (error) throw error;

      // modelSettings 상태 초기화
      setModelSettings([]);
      setEditMode(false);
      setEditingModel(null);
      setTempSettings({});
      setTempDescriptions({});
      setTempModelName('');
      
      showSnackbar('모든 메뉴얼 데이터가 초기화되었습니다.', 'success');
    } catch (error) {
      console.error('초기화 중 오류 발생:', error.message);
      showSnackbar(`초기화 실패: ${error.message}`, 'error');
    }
  };

  // 모델 추가 함수
  const handleAddModel = async () => {
    try {
      // UUID 형식으로 ID 생성
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const newModel = {
        model: '새 모델',
        series: '새 시리즈',
        parameters: { ...standardParameters },
        descriptions: { ...standardDescriptions },
        order_index: modelSettings.length,
        id: generateUUID() // UUID 형식으로 ID 생성
      };

      // Supabase에 새 모델 추가
      const { data, error } = await supabase
        .from('model_settings')
        .insert({
          id: newModel.id,
          model_name: newModel.model,
          series: newModel.series,
          parameters: newModel.parameters,
          descriptions: newModel.descriptions,
          order_index: newModel.order_index
        })
        .select();

      if (error) throw error;

      // 로컬 상태 업데이트
      setModelSettings(prev => [...prev, newModel]);
      showSnackbar('새 모델이 추가되었습니다.', 'success');
    } catch (error) {
      console.error('모델 추가 중 오류 발생:', error.message);
      showSnackbar(`모델 추가 실패: ${error.message}`, 'error');
    }
  };

  // 모델 삭제 함수
  const handleDeleteModel = async (modelIndex) => {
    try {
      const modelToDelete = modelSettings[modelIndex];
      
      // Supabase에서 모델 삭제
      const { error } = await supabase
        .from('model_settings')
        .delete()
        .eq('id', modelToDelete.id);

      if (error) throw error;

      // 로컬 상태에서 모델 제거
      setModelSettings(prev => prev.filter((_, index) => index !== modelIndex));
      
      // 편집 중이던 모델이 삭제된 경우 편집 모드 종료
      if (editingModel === modelIndex) {
        setEditMode(false);
        setEditingModel(null);
        setTempSettings({});
        setTempDescriptions({});
        setTempModelName('');
      } else if (editingModel > modelIndex) {
        // 삭제된 모델보다 뒤에 있던 편집 중인 모델의 인덱스 조정
        setEditingModel(editingModel - 1);
      }
      
      showSnackbar('모델이 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('모델 삭제 중 오류 발생:', error.message);
      showSnackbar(`모델 삭제 실패: ${error.message}`, 'error');
    }
  };

  // tempSettings 변경 추적
  useEffect(() => {
    console.log('tempSettings 변경됨:', tempSettings);
  }, [tempSettings]);

  // tempDescriptions 변경 추적
  useEffect(() => {
    console.log('tempDescriptions 변경됨:', tempDescriptions);
  }, [tempDescriptions]);

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
    console.log('편집 시작:', { modelIndex, model });
    
    setEditingModel(modelIndex);
    setOriginalSettings({ ...model.parameters });
    setOriginalDescriptions({ ...model.descriptions });
    setTempSettings({ ...model.parameters });
    setTempDescriptions({ ...model.descriptions });
    setTempModelName(model.model); // 모델명 임시 저장
    setEditMode(true);
    
    console.log('편집 모드 설정 완료:', { 
      modelIndex, 
      originalSettings: model.parameters, 
      tempSettings: model.parameters 
    });
    
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
    console.log('handleParameterChange 호출:', { param, value, currentTempSettings: tempSettings });
    
    const isStringParam = param === 'P05' || param.startsWith('E');
    
    setTempSettings(prev => {
      let newValue = value;
      if (!isStringParam) {
        const parsedValue = parseInt(value);
        console.log('parseInt 결과:', { value, parsedValue, isNaN: isNaN(parsedValue) });
        newValue = isNaN(parsedValue) ? 0 : parsedValue; // NaN이면 0으로 처리
      }

      const newSettings = { ...prev, [param]: newValue };
      console.log('파라미터 변경 후 newSettings:', newSettings);
      return newSettings;
    });
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
    // P05나 E 시리즈 파라미터는 문자열로, 나머지는 숫자로 처리
    const isStringParam = newParameter.param === 'P05' || newParameter.param.startsWith('E');
    setTempSettings(prev => ({
      ...prev,
      [newParameter.param]: isStringParam ? newParameter.value : parseInt(newParameter.value) || 0
    }));

    // 설명 추가
    if (newParameter.description) {
      setTempDescriptions(prev => ({
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
    
    setTempDescriptions(prev => {
      const newDescriptions = { ...prev };
      delete newDescriptions[paramToDelete];
      return newDescriptions;
    });
    
    showSnackbar(`${paramToDelete} 파라미터가 삭제되었습니다.`, 'info');
  };

  // 확인 대화상자 처리
  const handleConfirmAction = async () => {
    const { action } = confirmDialog;
    
    if (action === 'save') {
      try {
        console.log('저장 시작:', {
          editingModel,
          tempSettings,
          tempDescriptions,
          tempSettingsKeys: Object.keys(tempSettings),
          tempDescriptionsKeys: Object.keys(tempDescriptions)
        });

        const modelToSave = modelSettings[editingModel];
        // 모델명도 tempModelName에서 가져오도록 변경
        const { id, series } = modelToSave;
        const currentModelName = tempModelName;

        // Supabase에 데이터 저장 또는 업데이트
        const { data, error } = await supabase
          .from('model_settings')
          .upsert({
            id: id,
            model_name: currentModelName, // 변경된 모델명 사용
            series: series,
            parameters: tempSettings,
            descriptions: tempDescriptions,
            order_index: modelToSave.order_index // order_index 추가
          }, { onConflict: 'id' }); // id 기준으로 onConflict 변경

        if (error) throw error;

        // Supabase 저장 성공 후 로컬 상태 업데이트
        setModelSettings(prevSettings => {
          return prevSettings.map((m, idx) => {
            if (idx === editingModel) {
              return {
                ...m,
                parameters: { ...tempSettings },
                descriptions: { ...tempDescriptions },
                id: data ? data[0].id : m.id // 새로 삽입된 경우 id 업데이트
              };
            }
            return m;
          });
        });

        setEditMode(false);
        setEditingModel(null);
        showSnackbar('저장 성공', 'success');
      } catch (error) {
        console.error('저장 오류:', error);
        showSnackbar(`저장 실패: ${error.message}`, 'error');
      }
    } else if (action === 'cancel') {
      setTempSettings({ ...originalSettings });
      setTempDescriptions({ ...originalDescriptions });
      setTempModelName(modelSettings[editingModel].model); // 원본 모델명으로 복원
      setEditMode(false);
      setEditingModel(null);
      showSnackbar('편집이 취소되었습니다', 'info');
    } else if (action === 'restore') {
      setTempSettings({ ...originalSettings });
      setTempDescriptions({ ...originalDescriptions });
      showSnackbar('기본값으로 복원되었습니다', 'info');
    }
    
    setConfirmDialog({ open: false, action: null });
  };

  // X-Rider 모델별 디스플레이 쓰로틀 세팅값 (상태로 관리)

  // 컴포넌트 마운트 시 설정값 불러오기
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('model_settings')
          .select('id, model_name, series, parameters, descriptions, order_index') // order_index 추가
          .order('order_index', { ascending: true }); // order_index 기준으로 오름차순 정렬

        if (error) throw error;

        if (data && data.length > 0) {
          // DB에서 불러온 데이터로 modelSettings 초기화
          const initialSettings = data.map(dbModel => ({
            id: dbModel.id, // Supabase ID 추가
            model: dbModel.model_name,
            series: dbModel.series,
            parameters: dbModel.parameters || { ...standardParameters }, // DB에 없으면 표준값 사용
            descriptions: dbModel.descriptions || { ...standardDescriptions },
            order_index: dbModel.order_index // order_index 추가
          }));
          setModelSettings(initialSettings);
          showSnackbar('설정값을 성공적으로 불러왔습니다.', 'success');
        } else {
          // DB에 데이터가 없으면 기본 모델 설정으로 초기화하고 DB에 삽입
          const defaultModels = [
            {
              model: 'X200 맥스/X100 맥스/X200 프로',
              series: 'X200',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 0,
              id: '550e8400-e29b-41d4-a716-446655440001' // UUID 형식
            },
            {
              model: 'Turbo Pro',
              series: 'Turbo',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 1,
              id: '550e8400-e29b-41d4-a716-446655440002' // UUID 형식
            },
            {
              model: 'X200 Turbo',
              series: 'Turbo',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 2,
              id: '550e8400-e29b-41d4-a716-446655440003' // UUID 형식
            },
            {
              model: 'Mini Max',
              series: 'Mini',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 3,
              id: '550e8400-e29b-41d4-a716-446655440004' // UUID 형식
            },
            {
              model: 'Mini Pro',
              series: 'Mini',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 4,
              id: '550e8400-e29b-41d4-a716-446655440005' // UUID 형식
            },
            {
              model: 'Mini E',
              series: 'Mini',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 5,
              id: '550e8400-e29b-41d4-a716-446655440006' // UUID 형식
            },
            {
              model: 'X50',
              series: 'X50',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 6,
              id: '550e8400-e29b-41d4-a716-446655440007' // UUID 형식
            },
            {
              model: 'X100 Standard',
              series: 'X100',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 7,
              id: '550e8400-e29b-41d4-a716-446655440008' // UUID 형식
            },
            {
              model: 'X100 Pro',
              series: 'X100',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 8,
              id: '550e8400-e29b-41d4-a716-446655440009' // UUID 형식
            },
            {
              model: 'X200/New X100',
              series: 'X200',
              parameters: { ...standardParameters },
              descriptions: { ...standardDescriptions },
              order_index: 9,
              id: '550e8400-e29b-41d4-a716-446655440010' // UUID 형식
            },
            {
              model: 'X200S/X200 고급형',
              series: 'X200',
              parameters: {
                ...standardParameters,
                P13: 35  // 고급형만 P13이 35로 다름
              },
              descriptions: { ...standardDescriptions },
              order_index: 10,
              id: '550e8400-e29b-41d4-a716-446655440011' // UUID 형식
            }
          ];
          setModelSettings(defaultModels);
          // 기본값들을 DB에 삽입 (최초 1회만 실행)
          for (const model of defaultModels) {
            const { error: insertError } = await supabase
              .from('model_settings')
              .insert({
                id: model.id, // ID도 함께 삽입
                model_name: model.model,
                series: model.series,
                parameters: model.parameters,
                descriptions: model.descriptions,
                order_index: model.order_index // order_index 추가
              });
            if (insertError) console.error('기본 설정값 삽입 오류:', insertError);
          }
          showSnackbar('기본 설정값을 불러오고 DB에 저장했습니다.', 'info');
        }
      } catch (error) {
        console.error('설정값을 불러오는 중 오류 발생:', error.message);
        showSnackbar(`설정값 로드 실패: ${error.message}`, 'error');
      }
    };

    fetchSettings();
  }, []); // 빈 배열은 컴포넌트가 처음 마운트될 때만 실행됨

  // 시리즈별 모델 그룹화
  const modelsBySeries = modelSettings.reduce((acc, model) => {
    if (!acc[model.series]) {
      acc[model.series] = [];
    }
    acc[model.series].push(model);
    return acc;
  }, {});

  const seriesList = Object.keys(modelsBySeries);

  const renderParameterTable = (model, modelIndex) => {
    const isEditing = editMode && editingModel === modelIndex;
    const currentParams = isEditing ? tempSettings : model.parameters;
    const currentDescriptions = isEditing ? tempDescriptions : model.descriptions;
    
    console.log('renderParameterTable:', { 
      modelIndex, 
      isEditing, 
      editingModel, 
      tempSettings, 
      currentParams,
      modelParameters: model.parameters 
    });
    
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
                        key={`param-value-${param}`}
                        size="small"
                        type={param === 'P05' || param.startsWith('E') ? 'text' : 'number'}
                        value={String(tempSettings[param] || '')} // 항상 문자열로 변환
                        onChange={(e) => handleParameterChange(param, e.target.value)}
                        onBlur={(e) => console.log('TextField onBlur 이벤트 (값):', { param, eventValue: e.target.value })}
                        sx={{
                          width: param === 'P05' || param.startsWith('E') ? 200 : 100,
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
                    {isEditing ? (
                      <TextField
                        key={`param-desc-${param}`}
                        size="small"
                        multiline
                        rows={1}
                        value={String(tempDescriptions[param] || '')} // 항상 문자열로 변환
                        onChange={(e) => setTempDescriptions(prev => ({
                          ...prev,
                          [param]: e.target.value
                        }))}
                        onBlur={(e) => console.log('TextField onBlur 이벤트 (설명):', { param, eventValue: e.target.value })}
                        placeholder="파라미터 설명 입력"
                        sx={{
                          width: '100%',
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.875rem'
                          }
                        }}
                      />
                    ) : (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ fontSize: '0.875rem' }}
                      >
                        {currentDescriptions[param] || '설명 없음'}
                      </Typography>
                    )}
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
                    placeholder="P17, E06 등"
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

  // 모델 순서 변경 후 상태 업데이트 및 DB 저장
  const onDragEnd = async (result) => {
    if (!result.destination) {
      return;
    }

    const currentSeriesModels = Array.from(modelsBySeries[seriesList[selectedTab]]);
    const [movedModel] = currentSeriesModels.splice(result.source.index, 1);
    currentSeriesModels.splice(result.destination.index, 0, movedModel);

    // 변경된 순서에 따라 order_index를 업데이트하고 로컬 상태에 반영
    let orderCounter = 0;
    const updatedModelSettings = modelSettings.map(model => {
      const reorderedModel = currentSeriesModels.find(m => m.model === model.model);
      if (reorderedModel) {
        // 현재 탭의 모델 중 순서가 변경된 모델만 order_index 업데이트
        return {
          ...model,
          order_index: orderCounter++
        };
      }
      return model; // 현재 탭이 아닌 모델은 기존 순서 유지
    });

    // 최종적으로 전체 modelSettings 배열을 order_index 기준으로 다시 정렬
    updatedModelSettings.sort((a, b) => a.order_index - b.order_index);
    setModelSettings(updatedModelSettings);

    // 데이터베이스 업데이트
    try {
      const updates = currentSeriesModels.map((model, index) => ({
        id: model.id,
        model_name: model.model,
        order_index: index // 변경된 순서를 order_index로 설정
      }));

      // upsert를 사용하여 변경된 모델의 order_index만 업데이트
      const { error } = await supabase
        .from('model_settings')
        .upsert(updates, { onConflict: 'id' }); // id 기준으로 onConflict 변경

      if (error) throw error;

      showSnackbar('모델 순서가 성공적으로 저장되었습니다.', 'success');
    } catch (error) {
      console.error('모델 순서 저장 오류:', error.message);
      showSnackbar(`모델 순서 저장 실패: ${error.message}`, 'error');
    }
  };

  const renderSeriesModels = (series) => {
    const models = modelsBySeries[series];
    
    return (
      <Box sx={{ mt: 2 }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="models-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {models.map((model, index) => { // 여기를 index로 변경
                  const globalIndex = modelSettings.findIndex(m => m.model === model.model); // globalIndex는 startEdit용으로 유지
                  const isEditing = editMode && editingModel === globalIndex;
                  const currentModel = modelSettings[globalIndex];
                  
                  // draggableId를 더 안정적으로 생성
                  const draggableId = model.id || `model-${globalIndex}-${model.model}`;

                  return (
                    <Draggable 
                      key={`draggable-${model.id || globalIndex}`} // key와 draggableId를 분리
                      draggableId={draggableId} 
                      index={index} // Droppable 내에서의 index 사용
                      isDragDisabled={editMode} 
                    >
                      {(provided, snapshot) => (
                        <Accordion 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          // {...provided.dragHandleProps} // AccordionSummary로 이동
                          sx={{
                            mb: 1,
                            backgroundColor: snapshot.isDragging ? '#e0e0e0' : 'inherit',
                            cursor: editMode ? 'not-allowed' : 'grab',
                          }} 
                          disabled={editMode && !isEditing}
                        >
                          <AccordionSummary 
                            expandIcon={<ExpandMoreIcon />} 
                            {...provided.dragHandleProps} // 여기에 dragHandleProps 적용
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              {isEditing ? (
                                <TextField
                                  size="small"
                                  value={tempModelName}
                                  onChange={(e) => setTempModelName(e.target.value)}
                                  sx={{ flexGrow: 1, mr: 1 }}
                                />
                              ) : (
                                <Typography variant="h6">{model.model}</Typography>
                              )}
                              <Chip 
                                label={model.series} 
                                size="small" 
                                color="primary" 
                                variant="outlined" 
                              />
                              {!isEditing && (
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`"${model.model}" 모델을 삭제하시겠습니까?`)) {
                                      handleDeleteModel(globalIndex);
                                    }
                                  }}
                                  sx={{ ml: 'auto' }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              )}
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
                            
                            {renderParameterTable(currentModel, globalIndex)}
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          X-Rider 메뉴얼
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="warning"
            onClick={handleInitialize}
            sx={{ minWidth: 'auto' }}
          >
            초기화
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddModel}
            sx={{ minWidth: 'auto' }}
          >
            모델 추가
          </Button>
        </Box>
      </Box>

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
            />
          ))}
        </Tabs>
      </Paper>

      {/* 선택된 시리즈의 모델들 */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          {seriesList[selectedTab] ? `${seriesList[selectedTab]} 시리즈` : ''}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {seriesList[selectedTab] && modelsBySeries[seriesList[selectedTab]]
            ? `${modelsBySeries[seriesList[selectedTab]].length}개 모델의 설정값을 확인할 수 있습니다.`
            : '모델 설정값을 불러오는 중...'}
        </Typography>
        {seriesList[selectedTab] && renderSeriesModels(seriesList[selectedTab])}
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