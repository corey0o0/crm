const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 5001;

// Cloudmersive API 클라이언트 설정
const cloudmersiveApiClient = new CloudmersiveConvertApiClient.ConvertDocumentApi();
// API 키 설정
const cloudmersiveApiKey = process.env.CLOUDMERSIVE_API_KEY || 'YOUR_API_KEY_HERE';
const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
const Apikey = defaultClient.authentications['Apikey'];
Apikey.apiKey = cloudmersiveApiKey;

// CORS 설정
const allowedOrigins = [
  'http://localhost:3000',
  'https://crmapp8893.netlify.app',
  process.env.FRONTEND_URL,
  process.env.REACT_APP_FRONTEND_URL
].filter(Boolean);

// Global request logger commented out to reduce logging rate (Railway limit)
// app.use((req, res, next) => { console.log(req.method, req.url); next(); });
app.use(cors({
  origin: function (origin, callback) {
    // 서버 간 요청이거나 도메인 없는 요청은 개발 환경에서만 허용 (필요에 따라 정책 변경)
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[CORS Blocked] Origin: ${origin}`);
    callback(new Error('CORS 정책에 의해 차단되었습니다'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// 헬스 체크 엔드포인트 추가
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '서버가 정상적으로 실행 중입니다.' });
});

// 텔레그램 프록시 엔드포인트 (보안 강화: 프론트엔드 토큰 노출 차단)
app.post('/api/telegram/send', async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.REACT_APP_TELEGRAM_BOT_TOKEN;
    const defaultChatId = process.env.TELEGRAM_CHAT_ID || process.env.REACT_APP_TELEGRAM_CHAT_ID;
    
    if (!botToken) {
      return res.status(500).json({ success: false, error: '텔레그램 봇 토큰이 백엔드 서버에 설정되지 않았습니다.' });
    }

    const payload = {
      chat_id: req.body.chat_id || defaultChatId,
      ...req.body
    };

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[텔레그램 프록시] 전송 실패:', data);
      return res.status(response.status).json(data);
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('[텔레그램 프록시] 서버 에러:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 파일 업로드를 위한 multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 파일명에서 위험한 문자 제거
    const sanitizedOriginalname = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    // UUID 형태의 더 안전한 파일명 생성
    const crypto = require('crypto');
    const uniqueId = crypto.randomUUID();
    const timestamp = Date.now();
    const fileExtension = path.extname(sanitizedOriginalname);
    
    cb(null, `${uniqueId}-${timestamp}${fileExtension}`);
  }
});

// 파일 크기 제한 (10MB)
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // 한 번에 하나의 파일만
  },
  fileFilter: (req, file, cb) => {
    // 허용되는 파일 타입
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`지원되지 않는 파일 형식입니다. 허용되는 형식: ${allowedTypes.join(', ')}`), false);
    }
  }
});

// Cloudmersive API를 사용하여 PDF를 이미지로 변환하는 함수
async function convertPdfToImageWithCloudmersive(pdfPath) {
  try {
    console.log('Cloudmersive API를 사용하여 PDF를 이미지로 변환 시작...');
    
    // 출력 디렉토리 설정
    const outputDir = path.dirname(pdfPath);
    const pdfFileName = path.basename(pdfPath, '.pdf');
    
    // PDF 파일 읽기
    const inputFile = fs.readFileSync(pdfPath);
    
    // Cloudmersive API 호출 - 첫 페이지만 변환
    const result = await new Promise((resolve, reject) => {
      cloudmersiveApiClient.convertDocumentPdfToJpg(inputFile, (error, data, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
    
    // 결과 이미지 저장
    const imageFiles = [];
    if (result && result.JpgResultPages) {
      for (let i = 0; i < result.JpgResultPages.length; i++) {
        const page = result.JpgResultPages[i];
        const imagePath = path.join(outputDir, `${pdfFileName}-page-${i+1}.jpg`);
        fs.writeFileSync(imagePath, Buffer.from(page.Content, 'base64'));
        imageFiles.push(imagePath);
      }
    }
    
    console.log(`Cloudmersive PDF 변환 완료: ${imageFiles.length}개 이미지 생성됨`);
    return imageFiles;
  } catch (error) {
    console.error('Cloudmersive PDF 변환 실패:', error);
    throw error;
  }
}

// 개선된 PDF 변환 로직은 pdf-poppler 삭제로 제거됨

// Multer 에러 처리 미들웨어
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기가 10MB를 초과합니다.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '한 번에 하나의 파일만 업로드할 수 있습니다.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: '예상치 못한 필드에서 파일이 업로드되었습니다.' });
    }
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// 업로드된 이미지 제공 엔드포인트
app.get('/api/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // 1. 파일명 유효성 검증 (디렉토리 이동 문자 차단)
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: '잘못된 파일명입니다.' });
  }

  const uploadDir = path.resolve(__dirname, 'uploads');
  const filePath = path.resolve(uploadDir, filename);
  
  // 2. 최종 경로가 uploads 디렉토리 내부인지 엄격하게 확인 (Path Traversal 방어)
  if (!filePath.startsWith(uploadDir)) {
    return res.status(403).json({ error: '접근이 거부되었습니다.' });
  }
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// Playwright 기반 웹사이트 상품 검색 및 자동 주문 API 삭제됨
// =============================================
// 카페24 API 프록시 라우트
// =============================================
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// 서버에서 Supabase 서비스 키로 접근 (보안)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// 카페24 라우터 초기화
const cafe24Router = require('./cafe24Router')(supabaseAdmin, process.env.REDIS_URL);

app.use('/api/cafe24', cafe24Router);
app.use('/api/agencies', require('./agenciesRouter')(supabaseAdmin));

// =============================================
// Admin 사용자 관리 API
// =============================================
const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ error: '인증 확인 중 오류' });
  }
};

// 사용자 목록 조회
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: users.map(u => ({
      id: u.id, email: u.email, created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at
    }))});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 사용자 생성
app.post('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 비밀번호 변경
app.put('/api/admin/users/:id/password', adminAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 사용자 삭제
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    if (req.params.id === req.adminUser.id) return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 백그라운드 스케줄러 실행
require('./cronJobs')(supabaseAdmin, cafe24Router);

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});