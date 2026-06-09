import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Alert, List, ListItem, ListItemText, Chip,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const TYPE_LABEL = {
  order_no: '주문번호 중복',
  cafe24_overlap: '온라인 이중집계',
  same_customer_product_date: '동일고객·동일상품·동일일자',
  tx_dup: '트랜잭션 중복',
};

/**
 * 등록 시점 중복 경고 다이얼로그 (공용)
 * props: open, warnings:[{type,message,refs:[]}], onCancel, onProceed, proceedLabel
 */
export default function DuplicateWarningDialog({ open, warnings = [], onCancel, onProceed, proceedLabel = '무시하고 저장' }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
        <WarningAmberIcon color="warning" />
        중복 의심 {warnings.length}건 발견
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          아래 항목이 이미 등록되어 있을 수 있습니다. 확인 후 진행하세요.
        </Alert>
        {warnings.map((w, i) => (
          <Box key={i} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Chip size="small" color="warning" variant="outlined" label={TYPE_LABEL[w.type] || w.type} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{w.message}</Typography>
            </Box>
            {Array.isArray(w.refs) && w.refs.length > 0 && (
              <List dense disablePadding sx={{ pl: 2 }}>
                {w.refs.slice(0, 10).map((r, j) => (
                  <ListItem key={j} disablePadding sx={{ py: 0 }}>
                    <ListItemText primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }} primary={`· ${r}`} />
                  </ListItem>
                ))}
                {w.refs.length > 10 && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>… 외 {w.refs.length - 10}건</Typography>
                )}
              </List>
            )}
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="contained" autoFocus>취소 (다시 확인)</Button>
        <Button onClick={onProceed} color="warning">{proceedLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
