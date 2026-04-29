import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getAppSetting, saveAppSetting } from '../../api/settingsApi';

// 설정 가능한 메뉴 옵션 목록
const AVAILABLE_PERMISSIONS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'customers', label: '고객 관리' },
  { key: 'services', label: 'A/S 관리' },
  { key: 'shipment', label: '출고(매장) 관리' },
  { key: 'cafe24_orders', label: '온라인 주문관리' },
  { key: 'outbound_scan', label: '출고 검수' },
  { key: 'sales_entry', label: '수기 판매관리' },
  { key: 'tax_invoice', label: '세금계산서 발행' },
  { key: 'agencies', label: '거래처 관리' },
  { key: 'parts', label: '상품 관리' },
  { key: 'stocks', label: '매장 재고 관리' },
  { key: 'inventory_group', label: '재고관리 메뉴 전체' },
  { key: 'inventory_management', label: '입출고 관리' },
  { key: 'inventory_status', label: '재고 현황' },
  { key: 'inventory_stats', label: '입출고 통계' },
  { key: 'sales_stats', label: '매장 매출통계' },
  { key: 'online_stats', label: '온라인 매출통계' },
  { key: 'service_analysis', label: 'A/S 분석' },
  { key: 'board_group', label: '게시판 메뉴 전체' },
  { key: 'board_internal', label: '내부 게시판' },
  { key: 'board_cafe24', label: '카페24 게시판' },
  { key: 'admin_tools', label: '관리자 도구' }
];

export default function UserMenuSettings() {
  const { refreshMenuPermissions } = useAuth();
  
  const [permissionsMap, setPermissionsMap] = useState({}); // {"email": ["menu1", "menu2"]}
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // 새 이메일/편집 다이얼로그 상태
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' | 'edit'
  const [targetEmail, setTargetEmail] = useState('');
  const [selectedMenus, setSelectedMenus] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await getAppSetting('user_menu_permissions');
    if (data) {
      setPermissionsMap(data);
    }
    setLoading(false);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => setSnackbar({ ...snackbar, open: false });

  // 다이얼로그 열기 (추가 또는 편집)
  const handleOpenDialog = (email = '') => {
    if (email) {
      setDialogMode('edit');
      setTargetEmail(email);
      setSelectedMenus(permissionsMap[email] || []);
    } else {
      setDialogMode('add');
      setTargetEmail('');
      setSelectedMenus([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setTargetEmail('');
    setSelectedMenus([]);
  };

  // 체크박스 토글 핸들러
  const handleToggleMenu = (menuKey) => {
    setSelectedMenus((prev) => 
      prev.includes(menuKey) ? prev.filter(k => k !== menuKey) : [...prev, menuKey]
    );
  };

  // 다이얼로그 저장
  const handleSaveUser = async () => {
    const trimmedEmail = targetEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      showSnackbar('이메일을 입력해주세요.', 'error');
      return;
    }

    const updatedMap = {
      ...permissionsMap,
      [trimmedEmail]: selectedMenus
    };

    setLoading(true);
    const { error } = await saveAppSetting('user_menu_permissions', updatedMap);
    setLoading(false);

    if (error) {
      showSnackbar('설정 저장 중 오류가 발생했습니다.', 'error');
    } else {
      showSnackbar('성공적으로 저장되었습니다.', 'success');
      setPermissionsMap(updatedMap);
      refreshMenuPermissions(); // 변경 후 Context 업데이트
      handleCloseDialog();
    }
  };

  // 사용자 삭제
  const handleDeleteUser = async (email) => {
    if (!window.confirm(`정말로 ${email}의 권한 정보를 삭제하시겠습니까? (삭제된 경우 메뉴 접근이 차단될 수 있습니다)`)) {
      return;
    }

    const updatedMap = { ...permissionsMap };
    delete updatedMap[email];

    setLoading(true);
    const { error } = await saveAppSetting('user_menu_permissions', updatedMap);
    setLoading(false);

    if (error) {
      showSnackbar('삭제 중 오류가 발생했습니다.', 'error');
    } else {
      showSnackbar(`${email} 권한이 삭제되었습니다.`, 'success');
      setPermissionsMap(updatedMap);
      refreshMenuPermissions();
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">사용자별 메뉴 접근 권한</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('')}>
          새 이메일/사용자 추가
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        관리자(Master) 계정 외의 일반 사용자나 CRM/가맹점 계정의 메뉴 접근 범위를 설정합니다.<br />
        로그인 시 사용하는 이메일 주소를 입력하고 보일 메뉴를 체크해주세요.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
            <List>
              {Object.keys(permissionsMap).length === 0 && !loading && (
                <ListItem>
                  <ListItemText secondary="등록된 이메일 권한이 없습니다. 추가 버튼을 눌러 등록해주세요." />
                </ListItem>
              )}
              {Object.keys(permissionsMap).map((email, index) => (
                <React.Fragment key={email}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={<Typography fontWeight="bold">{email}</Typography>}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                          {permissionsMap[email]?.length > 0 ? (
                            permissionsMap[email].map(key => {
                              const menu = AVAILABLE_PERMISSIONS.find(p => p.key === key);
                              return (
                                <Typography key={key} variant="caption" sx={{ bgcolor: 'primary.light', color: 'primary.contrastText', px: 1, py: 0.5, borderRadius: 1 }}>
                                  {menu ? menu.label : key}
                                </Typography>
                              );
                            })
                          ) : (
                            <Typography variant="caption" color="error">권한 없음 (모든 메뉴 차단)</Typography>
                          )}
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleOpenDialog(email)} sx={{ mr: 1 }} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton edge="end" onClick={() => handleDeleteUser(email)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* 추가/편집 다이얼로그 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogMode === 'add' ? '새 계정 권한 추가' : '계정 권한 수정'}</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            label="사용자 이메일 (로그인 ID)"
            type="email"
            fullWidth
            variant="outlined"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            disabled={dialogMode === 'edit'}
            placeholder="예: user@slimpack.com"
            helperText="정확한 이메일 주소를 입력해야 동작합니다."
            sx={{ mb: 3 }}
          />

          <Typography variant="subtitle2" gutterBottom>접근 허용 메뉴 선택</Typography>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
            <FormGroup>
              <Grid container>
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <Grid item xs={6} key={perm.key}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedMenus.includes(perm.key)}
                          onChange={() => handleToggleMenu(perm.key)}
                          color="primary"
                        />
                      }
                      label={<Typography variant="body2">{perm.label}</Typography>}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormGroup>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">취소</Button>
          <Button onClick={handleSaveUser} variant="contained" disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
