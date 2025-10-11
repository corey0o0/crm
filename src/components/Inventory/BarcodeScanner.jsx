import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  QrCodeScanner as QrCodeScannerIcon
} from '@mui/icons-material';
import { BrowserMultiFormatReader } from '@zxing/library';

const BarcodeScanner = ({ open, onClose, onScan, onError }) => {
  const videoRef = useRef(null);
  const [codeReader, setCodeReader] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      initializeScanner();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [open]);

  const initializeScanner = async () => {
    try {
      const reader = new BrowserMultiFormatReader();
      setCodeReader(reader);
      setError(null);
    } catch (err) {
      setError('바코드 스캐너를 초기화할 수 없습니다.');
      console.error('Scanner initialization error:', err);
    }
  };

  const startScanning = async () => {
    if (!codeReader || !videoRef.current) return;

    try {
      setIsScanning(true);
      setError(null);

      // 카메라 권한 요청 및 스캔 시작
      const result = await codeReader.decodeFromVideoDevice(
        undefined, // 기본 카메라 사용
        videoRef.current,
        (result, err) => {
          if (result) {
            const code = result.getText();
            onScan(code);
            stopScanning();
            onClose();
          }
          if (err && !(err instanceof Error)) {
            // 스캔 중 오류 (일반적으로 무시)
            console.log('Scanning error:', err);
          }
        }
      );
    } catch (err) {
      setError('카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.');
      console.error('Scanning error:', err);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReader) {
      codeReader.reset();
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCodeScannerIcon />
            <Typography variant="h6">바코드 스캔</Typography>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ textAlign: 'center' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box
            ref={videoRef}
            sx={{
              width: '100%',
              maxWidth: 400,
              height: 300,
              backgroundColor: '#f5f5f5',
              border: '2px dashed #ccc',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2
            }}
          >
            {!isScanning && (
              <Box sx={{ textAlign: 'center' }}>
                <QrCodeScannerIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  스캔을 시작하려면 버튼을 클릭하세요
                </Typography>
              </Box>
            )}
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            상품의 바코드를 카메라에 비춰주세요
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={startScanning}
          disabled={isScanning || !!error}
          startIcon={<QrCodeScannerIcon />}
        >
          {isScanning ? '스캔 중...' : '스캔 시작'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BarcodeScanner;
