import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  LinearProgress,
  Chip,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  CloudUpload as CloudUploadIcon,
  History as HistoryIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  createBackup,
  downloadBackup,
  readBackupFile,
  restoreBackup,
  validateBackup,
  getBackupStats,
  getBackupSettings,
  saveBackupSettings,
  getBackupHistory,
  uploadBackupToGoogleDrive,
  saveBackupHistory,
  startBackupScheduler
} from '../../utils/backupUtils';
import { supabase } from '../../lib/supabaseClient';

const BackupManager = () => {
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupData, setBackupData] = useState(null);
  const [restoreOptions, setRestoreOptions] = useState({
    clearExisting: false,
    skipErrors: true,
    selectedTables: []
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const fileInputRef = useRef(null);
  
  // 자동백업 관련 상태
  const [autoBackupSettings, setAutoBackupSettings] = useState({
    enabled: false,
    frequency: 'daily',
    backup_time: '02:00:00',
    google_drive_folder_id: '',
    retention_count: 10
  });
  const [autoBackupDialogOpen, setAutoBackupDialogOpen] = useState(false);
  const [backupHistory, setBackupHistory] = useState([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const schedulerIntervalRef = useRef(null);

  // 컴포넌트 마운트 시 백업 설정 로드 및 스케줄러 시작
  useEffect(() => {
    const loadBackupSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const settings = await getBackupSettings(user.id);
        if (settings) {
          setAutoBackupSettings({
            enabled: settings.enabled || false,
            frequency: settings.frequency || 'daily',
            backup_time: settings.backup_time || '02:00:00',
            google_drive_folder_id: settings.google_drive_folder_id || '',
            retention_count: settings.retention_count || 10
          });
        }

        // 백업 이력 로드
        const history = await getBackupHistory(user.id, 10);
        setBackupHistory(history);

        // 자동백업 스케줄러 시작
        if (settings?.enabled) {
          schedulerIntervalRef.current = startBackupScheduler();
        }
      } catch (error) {
        console.error('백업 설정 로드 실패:', error);
      }
    };

    loadBackupSettings();

    // 컴포넌트 언마운트 시 스케줄러 정리
    return () => {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
      }
    };
  }, []);

  // 자동백업 설정 저장
  const handleSaveAutoBackupSettings = async () => {
    try {
      setIsSavingSettings(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      await saveBackupSettings(user.id, autoBackupSettings);
      
      // 스케줄러 재시작
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current);
      }
      if (autoBackupSettings.enabled) {
        schedulerIntervalRef.current = startBackupScheduler();
      }

      setSnackbar({
        open: true,
        message: '자동백업 설정이 저장되었습니다.',
        severity: 'success'
      });
      setAutoBackupDialogOpen(false);
    } catch (error) {
      console.error('자동백업 설정 저장 실패:', error);
      setSnackbar({
        open: true,
        message: `설정 저장 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 수동으로 구글 드라이브에 백업 업로드
  const handleUploadToGoogleDrive = async () => {
    try {
      if (!backupData) {
        throw new Error('먼저 백업을 생성해주세요.');
      }

      setIsBackingUp(true);
      const uploadResult = await uploadBackupToGoogleDrive(backupData, autoBackupSettings.google_drive_folder_id);
      
      // 백업 이력 저장
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await saveBackupHistory(user.id, {
          backup_type: 'manual',
          file_name: uploadResult.fileName,
          google_drive_file_id: uploadResult.fileId,
          google_drive_file_link: uploadResult.webViewLink,
          file_size: uploadResult.fileSize,
          total_tables: backupData.metadata.totalTables,
          total_records: backupData.metadata.totalRecords,
          status: 'success'
        });
      }

      setSnackbar({
        open: true,
        message: '구글 드라이브에 백업이 업로드되었습니다.',
        severity: 'success'
      });
    } catch (error) {
      console.error('구글 드라이브 업로드 실패:', error);
      setSnackbar({
        open: true,
        message: `업로드 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // 백업 이력 조회
  const handleLoadBackupHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const history = await getBackupHistory(user.id, 20);
      setBackupHistory(history);
      setHistoryDialogOpen(true);
    } catch (error) {
      console.error('백업 이력 조회 실패:', error);
      setSnackbar({
        open: true,
        message: `이력 조회 실패: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // 백업 생성
  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      setBackupProgress(0);
      setBackupDialogOpen(true);

      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const backup = await createBackup();
      clearInterval(progressInterval);
      setBackupProgress(100);
      setBackupData(backup);

      setSnackbar({
        open: true,
        message: '백업이 성공적으로 생성되었습니다.',
        severity: 'success'
      });

    } catch (error) {
      console.error('백업 생성 실패:', error);
      setSnackbar({
        open: true,
        message: `백업 생성 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // 백업 다운로드
  const handleDownloadBackup = () => {
    try {
      if (!backupData) {
        throw new Error('다운로드할 백업 데이터가 없습니다.');
      }

      downloadBackup(backupData);
      setSnackbar({
        open: true,
        message: '백업 파일이 다운로드되었습니다.',
        severity: 'success'
      });
      setBackupDialogOpen(false);

    } catch (error) {
      console.error('백업 다운로드 실패:', error);
      setSnackbar({
        open: true,
        message: `백업 다운로드 실패: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // 백업 파일 선택
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    readBackupFile(file)
      .then(backup => {
        const validation = validateBackup(backup);
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }

        setBackupData(backup);
        setRestoreDialogOpen(true);
        setSnackbar({
          open: true,
          message: '백업 파일이 성공적으로 로드되었습니다.',
          severity: 'success'
        });
      })
      .catch(error => {
        console.error('백업 파일 읽기 실패:', error);
        setSnackbar({
          open: true,
          message: `백업 파일 읽기 실패: ${error.message}`,
          severity: 'error'
        });
      });
  };

  // 데이터 복원
  const handleRestore = async () => {
    try {
      if (!backupData) {
        throw new Error('복원할 백업 데이터가 없습니다.');
      }

      setIsRestoring(true);
      setRestoreProgress(0);
      
      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      const results = await restoreBackup(backupData, restoreOptions);
      clearInterval(progressInterval);
      setRestoreProgress(100);

      const successCount = results.successful.length;
      const failCount = results.failed.length;
      const skipCount = results.skipped.length;

      setSnackbar({
        open: true,
        message: `복원 완료: 성공 ${successCount}개, 실패 ${failCount}개, 건너뜀 ${skipCount}개`,
        severity: successCount > 0 ? 'success' : 'warning'
      });

      setRestoreDialogOpen(false);

    } catch (error) {
      console.error('데이터 복원 실패:', error);
      setSnackbar({
        open: true,
        message: `데이터 복원 실패: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 백업 통계 정보
  const backupStats = backupData ? getBackupStats(backupData) : null;

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StorageIcon />
        데이터 백업/복원 관리
      </Typography>
      
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>관리자 전용 기능</strong><br/>
          이 기능은 시스템 관리자만 사용할 수 있습니다. 
          데이터 백업/복원은 전체 시스템에 영향을 미치므로 신중하게 사용하세요.
        </Typography>
      </Alert>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* 백업 생성 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BackupIcon />
                데이터 백업
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                전체 데이터베이스를 백업하여 안전하게 보관합니다.
              </Typography>
              <Button
                variant="contained"
                startIcon={<BackupIcon />}
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                fullWidth
              >
                {isBackingUp ? '백업 생성 중...' : '백업 생성'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* 데이터 복원 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RestoreIcon />
                데이터 복원
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                백업 파일에서 데이터를 복원합니다.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
              >
                백업 파일 선택
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* 백업 정보 */}
        {backupStats && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  백업 정보
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      백업 일시
                    </Typography>
                    <Typography variant="body1">
                      {new Date(backupStats.timestamp).toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      총 테이블 수
                    </Typography>
                    <Typography variant="body1">
                      {backupStats.totalTables}개
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      총 레코드 수
                    </Typography>
                    <Typography variant="body1">
                      {backupStats.totalRecords.toLocaleString()}개
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      버전
                    </Typography>
                    <Typography variant="body1">
                      v{backupStats.version}
                    </Typography>
                  </Grid>
                </Grid>
                {backupData && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<CloudUploadIcon />}
                      onClick={handleUploadToGoogleDrive}
                      disabled={isBackingUp}
                    >
                      구글 드라이브에 업로드
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* 자동백업 설정 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon />
                자동백업 설정
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                정기적으로 구글 드라이브에 자동 백업합니다.
              </Typography>
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoBackupSettings.enabled}
                      onChange={(e) => setAutoBackupSettings(prev => ({
                        ...prev,
                        enabled: e.target.checked
                      }))}
                    />
                  }
                  label={autoBackupSettings.enabled ? '자동백업 활성화됨' : '자동백업 비활성화됨'}
                />
              </Box>
              {autoBackupSettings.enabled && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    주기: {autoBackupSettings.frequency === 'daily' ? '매일' : 
                           autoBackupSettings.frequency === 'weekly' ? '매주' : '매월'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    시간: {autoBackupSettings.backup_time}
                  </Typography>
                </Box>
              )}
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setAutoBackupDialogOpen(true)}
                  fullWidth
                >
                  설정
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={handleLoadBackupHistory}
                  fullWidth
                >
                  이력
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 백업 생성 다이얼로그 */}
      <Dialog open={backupDialogOpen} onClose={() => setBackupDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BackupIcon />
            데이터 백업 생성
          </Box>
        </DialogTitle>
        <DialogContent>
          {isBackingUp ? (
            <Box>
              <Typography variant="body1" gutterBottom>
                데이터를 백업하고 있습니다...
              </Typography>
              <LinearProgress variant="determinate" value={backupProgress} sx={{ mt: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {backupProgress}% 완료
              </Typography>
            </Box>
          ) : backupData ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                백업이 성공적으로 생성되었습니다!
              </Alert>
              
              <Typography variant="h6" gutterBottom>
                백업 정보
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>테이블</TableCell>
                      <TableCell align="right">레코드 수</TableCell>
                      <TableCell align="center">상태</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(backupData.tables).map(([table, data]) => (
                      <TableRow key={table}>
                        <TableCell>{table}</TableCell>
                        <TableCell align="right">
                          {data.data ? data.data.length : 0}
                        </TableCell>
                        <TableCell align="center">
                          {data.error ? (
                            <Chip label="오류" color="error" size="small" />
                          ) : (
                            <Chip label="성공" color="success" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialogOpen(false)}>
            닫기
          </Button>
          {backupData && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadBackup}
            >
              다운로드
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 데이터 복원 다이얼로그 */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestoreIcon />
            데이터 복원
          </Box>
        </DialogTitle>
        <DialogContent>
          {isRestoring ? (
            <Box>
              <Typography variant="body1" gutterBottom>
                데이터를 복원하고 있습니다...
              </Typography>
              <LinearProgress variant="determinate" value={restoreProgress} sx={{ mt: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {restoreProgress}% 완료
              </Typography>
            </Box>
          ) : backupData ? (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>주의:</strong> 데이터 복원 시 기존 데이터가 덮어쓰여질 수 있습니다.
                  중요한 데이터는 미리 백업해두세요.
                </Typography>
              </Alert>

              <Typography variant="h6" gutterBottom>
                복원 옵션
              </Typography>
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreOptions.clearExisting}
                    onChange={(e) => setRestoreOptions(prev => ({
                      ...prev,
                      clearExisting: e.target.checked
                    }))}
                  />
                }
                label="기존 데이터 삭제 후 복원"
              />
              
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreOptions.skipErrors}
                    onChange={(e) => setRestoreOptions(prev => ({
                      ...prev,
                      skipErrors: e.target.checked
                    }))}
                  />
                }
                label="오류 발생 시 건너뛰기"
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                복원할 테이블 선택
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                선택하지 않으면 모든 테이블이 복원됩니다.
              </Typography>

              <List dense>
                {Object.entries(backupData.tables).map(([table, data]) => (
                  <ListItem key={table}>
                    <ListItemIcon>
                      {data.error ? (
                        <ErrorIcon color="error" />
                      ) : (
                        <CheckCircleIcon color="success" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={table}
                      secondary={`${data.data ? data.data.length : 0}개 레코드`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>
            취소
          </Button>
          {backupData && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<RestoreIcon />}
              onClick={handleRestore}
              disabled={isRestoring}
            >
              {isRestoring ? '복원 중...' : '복원 시작'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 자동백업 설정 다이얼로그 */}
      <Dialog open={autoBackupDialogOpen} onClose={() => setAutoBackupDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon />
            자동백업 설정
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoBackupSettings.enabled}
                  onChange={(e) => setAutoBackupSettings(prev => ({
                    ...prev,
                    enabled: e.target.checked
                  }))}
                />
              }
              label="자동백업 활성화"
            />
          </Box>

          {autoBackupSettings.enabled && (
            <>
              <FormControl fullWidth sx={{ mt: 3 }}>
                <InputLabel>백업 주기</InputLabel>
                <Select
                  value={autoBackupSettings.frequency}
                  label="백업 주기"
                  onChange={(e) => setAutoBackupSettings(prev => ({
                    ...prev,
                    frequency: e.target.value
                  }))}
                >
                  <MenuItem value="daily">매일</MenuItem>
                  <MenuItem value="weekly">매주</MenuItem>
                  <MenuItem value="monthly">매월</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="백업 시간"
                type="time"
                value={autoBackupSettings.backup_time}
                onChange={(e) => setAutoBackupSettings(prev => ({
                  ...prev,
                  backup_time: e.target.value
                }))}
                sx={{ mt: 2 }}
                InputLabelProps={{
                  shrink: true,
                }}
                helperText="백업을 실행할 시간을 설정하세요 (24시간 형식)"
              />

              <TextField
                fullWidth
                label="구글 드라이브 폴더 ID (선택사항)"
                value={autoBackupSettings.google_drive_folder_id}
                onChange={(e) => setAutoBackupSettings(prev => ({
                  ...prev,
                  google_drive_folder_id: e.target.value
                }))}
                sx={{ mt: 2 }}
                helperText="특정 폴더에 저장하려면 폴더 ID를 입력하세요. 비워두면 기본 백업 폴더에 저장됩니다."
              />

              <TextField
                fullWidth
                label="백업 보관 개수"
                type="number"
                value={autoBackupSettings.retention_count}
                onChange={(e) => setAutoBackupSettings(prev => ({
                  ...prev,
                  retention_count: parseInt(e.target.value) || 10
                }))}
                sx={{ mt: 2 }}
                InputProps={{
                  inputProps: { min: 1, max: 100 }
                }}
                helperText="최대 보관할 백업 파일 개수 (오래된 백업은 자동 삭제)"
              />

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  자동백업은 설정한 시간에 자동으로 실행됩니다.
                  백업 파일은 구글 드라이브에 저장되며, 최신 {autoBackupSettings.retention_count}개만 보관됩니다.
                </Typography>
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoBackupDialogOpen(false)}>
            취소
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAutoBackupSettings}
            disabled={isSavingSettings}
          >
            {isSavingSettings ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 백업 이력 다이얼로그 */}
      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            백업 이력
          </Box>
        </DialogTitle>
        <DialogContent>
          {backupHistory.length === 0 ? (
            <Alert severity="info">
              백업 이력이 없습니다.
            </Alert>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>일시</TableCell>
                    <TableCell>타입</TableCell>
                    <TableCell>파일명</TableCell>
                    <TableCell align="right">크기</TableCell>
                    <TableCell align="right">레코드 수</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell>링크</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backupHistory.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell>
                        {new Date(history.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={history.backup_type === 'automatic' ? '자동' : '수동'}
                          size="small"
                          color={history.backup_type === 'automatic' ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{history.file_name}</TableCell>
                      <TableCell align="right">
                        {history.file_size ? `${(history.file_size / 1024 / 1024).toFixed(2)} MB` : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {history.total_records?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={history.status === 'success' ? '성공' : '실패'}
                          size="small"
                          color={history.status === 'success' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        {history.google_drive_file_link ? (
                          <Button
                            size="small"
                            href={history.google_drive_file_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            열기
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BackupManager;
