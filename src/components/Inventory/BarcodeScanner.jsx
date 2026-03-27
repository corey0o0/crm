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

      // 브라우저 렌더링 컨텍스트 확인 (https 필수)
      if (window.isSecureContext === false) {
        throw new Error("카메라 접근은 HTTPS 환경이나 localhost에서만 가능합니다.");
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("이 브라우저에서는 카메라 접근 API를 지원하지 않습니다.");
      }

      // 카메라 디바이스 목록 가져오기 (권한 요청 유도)
      const devices = await codeReader.listVideoInputDevices();
      if (!devices || devices.length === 0) {
        throw new Error("연결된 카메라 디바이스를 찾을 수 없습니다.");
      }
      
      // 후면 카메라 우선 선택 로직
      let deviceId = devices[0].deviceId;
      const backCamera = devices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('후면'));
      if (backCamera) {
        deviceId = backCamera.deviceId;
      }

      // 카메라 스캔 시작
      codeReader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            const code = result.getText();
            onScan(code);
            stopScanning();
            onClose();
          }
          if (err && !(err.name === 'NotFoundException' || err.name === 'ChecksumException' || err.name === 'FormatException')) {
            // 지속적인 스캔 에러 무시 (바코드 못찾는 에러)
            // console.log('Scanning exception:', err);
          }
        }
      );
    } catch (err) {
      console.error('카메라 접근 에러:', err);
      let errorMsg = '카메라에 접근할 수 없습니다. 권한을 확인해주세요.';
      if (err.name === 'NotAllowedError') errorMsg = '카메라 접근이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.';
      else if (err.name === 'NotFoundError') errorMsg = '카메라 장치를 찾을 수 없습니다.';
      else if (err.message) errorMsg = err.message;
      
      setError(errorMsg);
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
