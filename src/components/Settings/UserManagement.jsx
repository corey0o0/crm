import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Alert, Snackbar, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, Tooltip, CircularProgress
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import LockResetIcon from '@mui/icons-material/LockReset';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { supabase } from '../../lib/supabaseClient';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 신규 계정 폼
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // 비밀번호 변경 다이얼로그
  const [resetDialog, setResetDialog] = useState({ open: false, userId: '', email: '' });
  const [newPassword, setNewPassword] = useState('');

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession())?.data?.session?.access_token;
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        // fallback: Supabase Admin API는 서버에서만 가능하므로 에러 처리
        showSnackbar('사용자 목록을 불러올 수 없습니다. 서버 API가 필요합니다.', 'warning');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      // 서버 API가 없으면 빈 목록 표시
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!email.trim()) {
      showSnackbar('이메일을 입력해주세요.', 'warning');
      return;
    }
    if (!password.trim() || password.length < 6) {
      showSnackbar('비밀번호는 6자 이상이어야 합니다.', 'warning');
      return;
    }

    setCreating(true);
    try {
      const token = (await supabase.auth.getSession())?.data?.session?.access_token;
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      if (res.ok) {
        showSnackbar(`계정이 생성되었습니다: ${email}`, 'success');
        setEmail('');
        setPassword('');
        fetchUsers();
      } else {
        showSnackbar(data.error || '계정 생성에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      showSnackbar('계정 생성 중 오류가 발생했습니다.', 'error');
    }
    setCreating(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      showSnackbar('비밀번호는 6자 이상이어야 합니다.', 'warning');
      return;
    }

    try {
      const token = (await supabase.auth.getSession())?.data?.session?.access_token;
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/admin/users/${resetDialog.userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });

      if (res.ok) {
        showSnackbar(`${resetDialog.email} 비밀번호가 변경되었습니다.`, 'success');
        setResetDialog({ open: false, userId: '', email: '' });
        setNewPassword('');
      } else {
        const data = await res.json();
        showSnackbar(data.error || '비밀번호 변경에 실패했습니다.', 'error');
      }
    } catch (err) {
      showSnackbar('비밀번호 변경 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`정말 ${userEmail} 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      const token = (await supabase.auth.getSession())?.data?.session?.access_token;
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showSnackbar(`${userEmail} 계정이 삭제되었습니다.`, 'success');
        fetchUsers();
      } else {
        const data = await res.json();
        showSnackbar(data.error || '계정 삭제에 실패했습니다.', 'error');
      }
    } catch (err) {
      showSnackbar('계정 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  return (
    <Box>
      {/* 신규 계정 생성 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon color="primary" /> 신규 계정 생성
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            label="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="small"
            sx={{ minWidth: 250 }}
            placeholder="example@company.com"
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
              placeholder="6자 이상"
            />
            <Tooltip title="랜덤 비밀번호 생성">
              <Button variant="outlined" size="small" onClick={generatePassword} sx={{ minWidth: 'auto', px: 1 }}>
                생성
              </Button>
            </Tooltip>
            {password && (
              <Tooltip title="복사">
                <IconButton size="small" onClick={() => { navigator.clipboard.writeText(password); showSnackbar('비밀번호가 복사되었습니다.'); }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <PersonAddIcon />}
          >
            {creating ? '생성 중...' : '계정 생성'}
          </Button>
        </Box>
      </Paper>

      {/* 사용자 목록 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          등록된 사용자 ({users.length}명)
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : users.length === 0 ? (
          <Alert severity="info">
            사용자 목록을 불러오려면 서버에 admin API가 필요합니다.
            서버가 실행 중인지 확인해주세요.
          </Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>이메일</TableCell>
                <TableCell>생성일</TableCell>
                <TableCell>마지막 로그인</TableCell>
                <TableCell>상태</TableCell>
                <TableCell align="right">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}</TableCell>
                  <TableCell>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ko-KR') : '없음'}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.email_confirmed_at ? '활성' : '미인증'}
                      color={u.email_confirmed_at ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="비밀번호 변경">
                      <IconButton size="small" onClick={() => setResetDialog({ open: true, userId: u.id, email: u.email })}>
                        <LockResetIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="계정 삭제">
                      <IconButton size="small" color="error" onClick={() => handleDeleteUser(u.id, u.email)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* 비밀번호 변경 다이얼로그 */}
      <Dialog open={resetDialog.open} onClose={() => setResetDialog({ open: false, userId: '', email: '' })}>
        <DialogTitle>비밀번호 변경 - {resetDialog.email}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="새 비밀번호"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="6자 이상"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setResetDialog({ open: false, userId: '', email: '' }); setNewPassword(''); }}>취소</Button>
          <Button onClick={handleResetPassword} variant="contained">변경</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
