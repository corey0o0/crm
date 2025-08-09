import React from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  Chip,
  IconButton
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';

const ReceiptUploadSection = ({
  receiptFiles,
  onFileUpload,
  onFilePreview,
  onFileDelete,
  onReceiptScan
}) => {
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      onFileUpload(files);
    }
    // 같은 파일을 다시 선택할 수 있도록 value 초기화
    event.target.value = '';
  };

  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        영수증 첨부
      </Typography>
      
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          component="label"
          startIcon={<CloudUploadIcon />}
          sx={{
            color: '#666',
            borderColor: '#ddd',
            '&:hover': {
              borderColor: '#bbb',
              bgcolor: '#f9f9f9'
            }
          }}
        >
          파일 업로드
          <input
            type="file"
            hidden
            multiple
            accept="image/*,.pdf"
            onChange={handleFileSelect}
          />
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<ReceiptIcon />}
          onClick={onReceiptScan}
          sx={{
            color: '#ff9800',
            borderColor: '#ff9800',
            '&:hover': {
              bgcolor: 'rgba(255, 152, 0, 0.04)',
              borderColor: '#f57c00'
            }
          }}
        >
          영수증 스캔
        </Button>
      </Stack>

      {receiptFiles.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            첨부된 파일 ({receiptFiles.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {receiptFiles.map((file, index) => (
              <Chip
                key={index}
                label={file.name}
                variant="outlined"
                size="small"
                icon={<OpenInNewIcon />}
                deleteIcon={<DeleteIcon />}
                onClick={() => onFilePreview(file)}
                onDelete={() => onFileDelete(index)}
                sx={{
                  maxWidth: 200,
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }
                }}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default ReceiptUploadSection;