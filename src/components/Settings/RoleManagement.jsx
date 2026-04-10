import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  Alert,
  Snackbar,
  Grid,
  Chip,
  Divider,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  updateRolePermissions,
  assignUserRole,
  assignUserRoleByEmail,
  removeUserRole
} from '../../api/roleApi';
import { supabase } from '../../lib/supabaseClient';
import { safeRetry, shouldRetry, getErrorMessage, isOffline } from '../../utils/networkUtils';

// 사용 가능한 모든 메뉴 권한 목록
const AVAILABLE_PERMISSIONS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'customers', label: '고객 관리' },
  { key: 'services', label: 'A/S 관리' },
  { key: 'shipment', label: '출고 관리' },
  { key: 'parts', label: '상품 관리' },
  { key: 'stocks', label: '매장 재고 관리' },
  // { key: 'inventory_group', label: '재고관리 메뉴 전체' },
  { key: 'inventory_management', label: '입출고 관리' },
  { key: 'inventory_status', label: '재고 현황' },
  { key: 'inventory_stats', label: '입출고 통계' }, // 입출고 관리 비활성화
  { key: 'sales_stats', label: '매출 통계' },
  { key: 'board_group', label: '게시판 메뉴 전체' },
  { key: 'board_internal', label: '내부 게시판' },
  { key: 'board_cafe24', label: '카페24 게시판' },
  { key: 'role_settings', label: '권한 설정' },
  { key: 'backup_management', label: '데이터 백업/복원' },
  { key: 'receipts', label: '영수증 스캐너' },
  { key: 'google_drive_test', label: 'Google Drive 테스트' },
  { key: 'brand_settings', label: '브랜드 설정' }
];

function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPermissionDialog, setOpenPermissionDialog] = useState(false);
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [users, setUsers] = useState([]);
  const [allAvailableUsers, setAllAvailableUsers] = useState([]);
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('');

  useEffect(() => {
    loadRoles();
    loadUsers();
    loadAllAvailableUsers();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    const { data, error } = await getRoles();
    if (!error && data) {
      setRoles(data);
    } else {
      showSnackbar('역할 로드 실패', 'error');
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      // RPC 함수를 사용하여 모든 사용자와 역할 정보 가져오기
      const { data, error } = await supabase.rpc('get_all_users_with_roles');
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        setUsers([]);
        return;
      }
      
      // 데이터를 컴포넌트 형식에 맞게 변환
      const formattedUsers = data.map(user => ({
        id: user.user_id,
        email: user.email,
        roles: user.roles && Array.isArray(user.roles) ? user.roles : []
      }));
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error('사용자 로드 오류:', error);
      // RPC 함수가 없으면 기본 방식으로 로드
      try {
        const { data: userRolesData } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            roles (
              id,
              name
            )
          `);
        
        if (!userRolesData) {
          setUsers([]);
          return;
        }
        
        // 사용자 ID별로 그룹화
        const userMap = {};
        userRolesData.forEach(item => {
          if (!userMap[item.user_id]) {
            userMap[item.user_id] = {
              id: item.user_id,
              email: `사용자 ${item.user_id.substring(0, 8)}...`,
              roles: []
            };
          }
          if (item.roles) {
            userMap[item.user_id].roles.push(item.roles);
          }
        });
        
        setUsers(Object.values(userMap));
      } catch (fallbackError) {
        console.error('대체 방식 로드 실패:', fallbackError);
        setUsers([]);
      }
    }
  };

  // 역할 할당을 위한 전체 사용자 목록 로드
  const loadAllAvailableUsers = async () => {
    try {
      // RPC 함수를 사용하여 모든 사용자 가져오기
      const { data, error } = await supabase.rpc('get_all_users_with_roles');
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        setAllAvailableUsers([]);
        return;
      }
      
      // 이메일만 추출 (중복 제거)
      const userEmails = [...new Set(data.map(user => user.email).filter(email => email))];
      setAllAvailableUsers(userEmails);
      
    } catch (error) {
      console.error('전체 사용자 목록 로드 오류:', error);
      setAllAvailableUsers([]);
    }
  };

  const handleOpenDialog = (role = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({ name: role.name, description: role.description || '' });
    } else {
      setEditingRole(null);
      setFormData({ name: '', description: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRole(null);
    setFormData({ name: '', description: '' });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showSnackbar('역할 이름을 입력하세요', 'error');
      return;
    }

    if (editingRole) {
      const { error } = await updateRole(editingRole.id, formData);
      if (error) {
        showSnackbar('역할 수정 실패', 'error');
      } else {
        showSnackbar('역할이 수정되었습니다', 'success');
        loadRoles();
        handleCloseDialog();
      }
    } else {
      const { error } = await createRole(formData);
      if (error) {
        showSnackbar('역할 생성 실패', 'error');
      } else {
        showSnackbar('역할이 생성되었습니다', 'success');
        loadRoles();
        handleCloseDialog();
      }
    }
  };

  const handleDelete = async (roleId) => {
    if (!window.confirm('정말로 이 역할을 삭제하시겠습니까?')) {
      return;
    }

    const { error } = await deleteRole(roleId);
    if (error) {
      showSnackbar('역할 삭제 실패', 'error');
    } else {
      showSnackbar('역할이 삭제되었습니다', 'success');
      loadRoles();
    }
  };

  const handleOpenPermissionDialog = async (role) => {
    setCurrentRole(role);
    const { data } = await getRolePermissions(role.id);
    setRolePermissions(data || []);
    setOpenPermissionDialog(true);
  };

  const handleClosePermissionDialog = () => {
    setOpenPermissionDialog(false);
    setCurrentRole(null);
    setRolePermissions([]);
  };

  const handlePermissionToggle = (permissionKey) => {
    setRolePermissions(prev => {
      if (prev.includes(permissionKey)) {
        return prev.filter(p => p !== permissionKey);
      } else {
        return [...prev, permissionKey];
      }
    });
  };

  const handleSavePermissions = async () => {
    const { error } = await updateRolePermissions(currentRole.id, rolePermissions);
    if (error) {
      showSnackbar('권한 업데이트 실패', 'error');
    } else {
      showSnackbar('권한이 업데이트되었습니다', 'success');
      handleClosePermissionDialog();
    }
  };

  const handleOpenUserDialog = () => {
    setOpenUserDialog(true);
  };

  const handleCloseUserDialog = () => {
    setOpenUserDialog(false);
  };

  const handleOpenAssignDialog = () => {
    setAssignEmail('');
    setAssignRole('');
    setOpenAssignDialog(true);
  };

  const handleCloseAssignDialog = () => {
    setOpenAssignDialog(false);
    setAssignEmail('');
    setAssignRole('');
  };

  const handleAssignRoleByEmail = async () => {
    if (!assignEmail || !assignRole) {
      showSnackbar('이메일과 역할을 모두 입력하세요', 'error');
      return;
    }

    try {
      // 이메일로 역할 할당
      const { error } = await assignUserRoleByEmail(assignEmail, assignRole);
      
      if (error) {
        throw error;
      }

      showSnackbar(`${assignEmail}에게 역할이 할당되었습니다`, 'success');
      handleCloseAssignDialog();
      loadUsers();
      loadAllAvailableUsers(); // 사용자 목록도 새로고침
    } catch (error) {
      console.error('역할 할당 오류:', error);
      showSnackbar(error.message || '역할 할당에 실패했습니다', 'error');
    }
  };

  const handleRemoveRole = async (userId, roleId) => {
    if (!window.confirm('정말로 이 역할을 제거하시겠습니까?')) {
      return;
    }

    const { error } = await removeUserRole(userId, roleId);
    if (error) {
      showSnackbar('역할 제거 실패', 'error');
    } else {
      showSnackbar('역할이 제거되었습니다', 'success');
      loadUsers();
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          역할 및 권한 관리
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={handleOpenUserDialog}
            sx={{ mr: 2 }}
          >
            사용자 관리
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            역할 추가
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {roles.map((role) => (
          <Grid item xs={12} md={6} lg={4} key={role.id}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    {role.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {role.description}
                  </Typography>
                </Box>
                <Box>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(role)}
                    color="primary"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(role.id)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleOpenPermissionDialog(role)}
              >
                권한 설정
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* 역할 추가/수정 Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRole ? '역할 수정' : '역할 추가'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="역할 이름"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="설명"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>취소</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingRole ? '수정' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 권한 설정 Dialog */}
      <Dialog open={openPermissionDialog} onClose={handleClosePermissionDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {currentRole?.name} - 권한 설정
        </DialogTitle>
        <DialogContent>
          <FormGroup>
            {AVAILABLE_PERMISSIONS.map((permission) => (
              <FormControlLabel
                key={permission.key}
                control={
                  <Checkbox
                    checked={rolePermissions.includes(permission.key)}
                    onChange={() => handlePermissionToggle(permission.key)}
                  />
                }
                label={permission.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePermissionDialog}>취소</Button>
          <Button onClick={handleSavePermissions} variant="contained">
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* 사용자 관리 Dialog */}
      <Dialog open={openUserDialog} onClose={handleCloseUserDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>사용자 역할 관리</span>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAssignDialog}
              size="small"
            >
              새 사용자에게 역할 할당
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>사용자</TableCell>
                  <TableCell>할당된 역할</TableCell>
                  <TableCell align="center">작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Typography variant="body2">{user.email}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {user.id.substring(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Chip
                                key={role.id}
                                label={role.name}
                                size="small"
                                color="primary"
                                variant="outlined"
                                onDelete={() => handleRemoveRole(user.id, role.id)}
                              />
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              역할 없음
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption" color="text.secondary">
                          역할 추가는 위의 버튼 사용
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                        아직 역할이 할당된 사용자가 없습니다.
                        <br />
                        위의 "새 사용자에게 역할 할당" 버튼을 클릭하세요.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUserDialog}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 역할 할당 Dialog */}
      <Dialog open={openAssignDialog} onClose={handleCloseAssignDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          사용자에게 역할 할당
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              fullWidth
              freeSolo
              options={allAvailableUsers}
              value={assignEmail}
              onChange={(event, newValue) => {
                setAssignEmail(newValue || '');
              }}
              onInputChange={(event, newInputValue) => {
                setAssignEmail(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="사용자 이메일"
                  placeholder="이메일을 선택하거나 입력하세요"
                  margin="normal"
                  helperText={`등록된 사용자 ${allAvailableUsers.length}명 | 목록에서 선택하거나 직접 입력`}
                />
              )}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              select
              label="역할 선택"
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value)}
              margin="normal"
              SelectProps={{
                native: true,
              }}
              helperText="할당할 역할을 선택하세요"
            >
              <option value="">선택하세요</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} - {role.description}
                </option>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignDialog}>취소</Button>
          <Button onClick={handleAssignRoleByEmail} variant="contained" disabled={!assignEmail || !assignRole}>
            할당
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

    </Box>
  );
}

export default RoleManagement;

