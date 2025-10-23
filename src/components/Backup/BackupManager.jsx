import React, { useState, useRef } from 'react';
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
  IconButton,
  Tooltip,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Storage as StorageIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  createBackup,
  downloadBackup,
  readBackupFile,
  restoreBackup,
  validateBackup,
  getBackupStats
} from '../../utils/backupUtils';

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
              </CardContent>
            </Card>
          </Grid>
        )}
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
