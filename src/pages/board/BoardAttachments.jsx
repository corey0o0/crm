import React from 'react';
import { Box, Typography, IconButton, Link, Stack } from '@mui/material';
import { Close as CloseIcon, InsertDriveFile as FileIcon } from '@mui/icons-material';

const isImage = (n = '') => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n);

// 게시판 첨부파일 목록 (이미지=썸네일, 그 외=파일 링크). editable면 개별 삭제 버튼.
function BoardAttachments({ attachments = [], editable = false, onRemove }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        첨부파일 ({attachments.length})
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {attachments.map((f, i) => (
          <Box
            key={f.url || i}
            sx={{
              position: 'relative',
              border: '1px solid #e0e0e0',
              borderRadius: 1,
              p: 1,
              width: isImage(f.name) ? 120 : 180,
            }}
          >
            {editable && (
              <IconButton
                size="small"
                onClick={() => onRemove?.(i)}
                sx={{
                  position: 'absolute', top: -10, right: -10,
                  bgcolor: 'background.paper', border: '1px solid #ccc',
                  '&:hover': { bgcolor: '#f5f5f5' },
                }}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            )}
            {isImage(f.name) ? (
              <Box component="a" href={f.url} target="_blank" rel="noopener noreferrer">
                <Box
                  component="img"
                  src={f.url}
                  alt={f.name}
                  sx={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 0.5, display: 'block' }}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </Typography>
              </Box>
            ) : (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <FileIcon fontSize="small" color="action" />
                <Link href={f.url} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {f.name}
                </Link>
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default BoardAttachments;
