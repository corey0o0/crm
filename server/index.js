const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');
const { searchProductOnWebsite, processOrderOnWebsite } = require('./playwrightOrderService');
require('dotenv').config();

// pdf-poppler는 Linux에서 지원 안 됨 → 조건부 로드
let pdfPoppler = null;
try {
  pdfPoppler = require('pdf-poppler');
} catch (e) {
  console.warn('[서버] pdf-poppler 로드 실패 (Linux에서는 미지원):', e.message);
}

const app = express();
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

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.includes('railway.app')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS 정책에 의해 차단되었습니다'));
  },
  credentials: true
}));
app.use(express.json());

// 헬스 체크 엔드포인트 추가
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '서버가 정상적으로 실행 중입니다.' });
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

// 개선된 PDF를 이미지로 변환하는 함수
async function convertPdfToImage(pdfPath) {
  try {
    console.log('PDF를 이미지로 변환 시작...');
    
    // 출력 디렉토리 설정
    const outputDir = path.dirname(pdfPath);
    const pdfFileName = path.basename(pdfPath, '.pdf');
    const outputPrefix = path.join(outputDir, pdfFileName);
    
    // PDF 변환 옵션 개선
    const opts = {
      format: 'jpeg',      // 출력 형식 (jpeg, png)
      out_dir: outputDir,  // 출력 디렉토리
      out_prefix: pdfFileName, // 출력 파일 접두사
      page: null,          // 모든 페이지 변환
      scale: 3.0,          // 해상도 스케일 (높일수록 고해상도)
      density: 400,        // DPI 설정 (높일수록 고해상도)
      quality: 100,        // JPEG 품질 (1-100)
    };
    
    // PDF를 이미지로 변환 (macOS 전용, Linux 미지원)
    if (!pdfPoppler) {
      throw new Error('PDF 변환 기능은 현재 서버 환경에서 지원되지 않습니다.');
    }
    await pdfPoppler.convert(pdfPath, opts);
    
    // 생성된 이미지 파일 목록 가져오기
    const imageFiles = fs.readdirSync(outputDir)
      .filter(file => file.startsWith(pdfFileName) && file.endsWith('.jpg'))
      .map(file => path.join(outputDir, file))
      .sort(); // 페이지 순서대로 정렬
    
    console.log(`PDF 변환 완료: ${imageFiles.length}개 이미지 생성됨`);
    return imageFiles;
  } catch (error) {
    console.error('PDF 변환 실패:', error);
    throw error;
  }
}

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
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// 웹사이트 상품 검색 API
app.post('/api/orders/search-product', async (req, res) => {
  try {
    const { brand, partName, partCode, barcode } = req.body;

    if (!brand || !partName) {
      return res.status(400).json({ error: '브랜드와 부품명은 필수입니다.' });
    }

    const result = await searchProductOnWebsite(brand, partName, partCode, barcode);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('상품 검색 API 오류:', error);
    res.status(500).json({ error: `상품 검색 중 오류가 발생했습니다: ${error.message}` });
  }
});

// 주문 처리 API
app.post('/api/orders/process', async (req, res) => {
  try {
    const { brand, orderItems } = req.body;

    if (!brand || !orderItems || !Array.isArray(orderItems)) {
      return res.status(400).json({ error: '브랜드와 주문 항목은 필수입니다.' });
    }

    const result = await processOrderOnWebsite(brand, orderItems);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('주문 처리 API 오류:', error);
    res.status(500).json({ error: `주문 처리 중 오류가 발생했습니다: ${error.message}` });
  }
});

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

/**
 * 카페24 프론트엔드 설정 제공
 */
app.get('/api/cafe24/config', (req, res) => {
  res.json({
    mall_id: process.env.CAFE24_MALL_ID || '',
    client_id: process.env.CAFE24_CLIENT_ID || ''
  });
});

/**
 * 환경 변수(.env) 자동 갱신 함수
 */
function updateEnvFile(key, value) {
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, envContent);
  process.env[key] = value;
}

/**
 * 카페24 환경 변수 기반 설정 가져오기
 */
async function getCafe24Settings() {
  return {
    mall_id: process.env.CAFE24_MALL_ID,
    access_token: process.env.CAFE24_ACCESS_TOKEN,
    refresh_token: process.env.CAFE24_REFRESH_TOKEN,
    token_expires_at: process.env.CAFE24_TOKEN_EXPIRES_AT,
    board_no: process.env.CAFE24_BOARD_NO || 1
  };
}

/**
 * 액세스 토큰 갱신
 */
async function refreshCafe24Token(settings) {
  const credentials = Buffer.from(
    `${process.env.CAFE24_CLIENT_ID}:${process.env.CAFE24_CLIENT_SECRET}`
  ).toString('base64');

  const resp = await axios.post(
    `https://${process.env.CAFE24_MALL_ID}.cafe24api.com/api/v2/oauth/token`,
    `grant_type=refresh_token&refresh_token=${settings.refresh_token}`,
    {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const { access_token, refresh_token, expires_in } = resp.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  // .env 파일과 메모리에 동시 갱신
  updateEnvFile('CAFE24_ACCESS_TOKEN', access_token);
  updateEnvFile('CAFE24_REFRESH_TOKEN', refresh_token);
  updateEnvFile('CAFE24_TOKEN_EXPIRES_AT', expiresAt);

  console.log('[Cafe24] 토큰 로컬 .env 에 갱신 및 저장 완료');
  return { ...settings, access_token, refresh_token, token_expires_at: expiresAt };
}

/**
 * 유효한 액세스 토큰 가져오기 (만료 시 자동 갱신)
 */
async function getValidToken(settings) {
  if (!settings.access_token) throw new Error('카페24 액세스 토큰이 없습니다. 먼저 카페24 연동 설정을 완료해주세요.');
  
  const now = new Date();
  const expiresAt = settings.token_expires_at ? new Date(settings.token_expires_at) : now;
  
  // 5분 여유를 두고 갱신
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('[Cafe24] 액세스 토큰 만료 임박, 갱신 중...');
    const refreshed = await refreshCafe24Token(settings);
    return refreshed.access_token;
  }
  
  return settings.access_token;
}

// OAuth 인증 코드 → 액세스 토큰 교환
app.post('/api/cafe24/auth/callback', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    const mall_id = process.env.CAFE24_MALL_ID;
    const client_id = process.env.CAFE24_CLIENT_ID;
    const client_secret = process.env.CAFE24_CLIENT_SECRET;

    if (!code || !mall_id || !client_id || !client_secret) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다. (서버 환경 변수 확인 필요)' });
    }

    const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
    const resp = await axios.post(
      `https://${mall_id}.cafe24api.com/api/v2/oauth/token`,
      `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = resp.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // DB가 아닌 .env 파일에 갱신 내역 덮어쓰기 저장
    updateEnvFile('CAFE24_ACCESS_TOKEN', access_token);
    updateEnvFile('CAFE24_REFRESH_TOKEN', refresh_token);
    updateEnvFile('CAFE24_TOKEN_EXPIRES_AT', expiresAt);

    console.log('[Cafe24] 최초 인증 토큰이 .env 에 성공적으로 저장되었습니다.');

    res.json({ success: true, message: '카페24 연동이 완료되었습니다.' });
  } catch (error) {
    console.error('[Cafe24] OAuth 콜백 오류:', error?.response?.data || error.message);
    res.status(500).json({ error: `카페24 인증 실패: ${error?.response?.data?.error_description || error.message}` });
  }
});

// 카페24 게시판 목록 조회
app.get('/api/cafe24/boards', async (req, res) => {
  try {
    const settings = await getCafe24Settings();
    const token = await getValidToken(settings);

    const resp = await axios.get(
      `https://${process.env.CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/boards`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': '2024-06-01'
        }
      }
    );

    res.json({ boards: resp.data.boards || [] });
  } catch (error) {
    console.error('[Cafe24] 게시판 목록 조회 오류:', error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data?.errors?.[0]?.message || error.message });
  }
});

// 카페24 게시판 게시글 목록 조회
app.get('/api/cafe24/boards/:boardNo/articles', async (req, res) => {
  try {
    const settings = await getCafe24Settings();
    const token = await getValidToken(settings);
    const { boardNo } = req.params;
    const { limit = 20, start_no, since_article_no } = req.query;

    const params = new URLSearchParams({ limit: String(limit) });
    if (start_no) params.append('start_no', start_no);

    const resp = await axios.get(
      `https://${process.env.CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/boards/${boardNo}/articles?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': '2024-06-01'
        }
      }
    );

    res.json({
      articles: resp.data.articles || [],
      count: resp.data.count
    });
  } catch (error) {
    console.error('[Cafe24] 게시글 조회 오류:', error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data?.errors?.[0]?.message || error.message });
  }
});

// 카페24 게시글 → CRM Supabase 동기화
app.post('/api/cafe24/sync', async (req, res) => {
  try {
    const settings = await getCafe24Settings();
    const token = await getValidToken(settings);
    const boardNo = req.body.board_no || settings.board_no || 1;
    
    console.log(`[Cafe24] 게시판 ${boardNo} 동기화 시작...`);

    // 마지막 동기화 이후 게시글 가져오기 (최대 100개)
    const resp = await axios.get(
      `https://${process.env.CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/boards/${boardNo}/articles?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': '2024-06-01'
        }
      }
    );

    const articles = resp.data.articles || [];
    console.log(`[Cafe24] ${articles.length}개 게시글 가져옴`);

    let inserted = 0;
    let skipped = 0;

    for (const article of articles) {
      const { error } = await supabaseAdmin
        .from('board_posts')
        .upsert({
          title: article.title,
          content: article.content || article.content_text || '',
          author_email: article.writer?.email || null,
          source: 'cafe24',
          cafe24_article_no: article.article_no,
          cafe24_board_no: parseInt(boardNo),
          cafe24_writer_name: article.writer?.name || null,
          cafe24_writer_email: article.writer?.email || null,
          cafe24_url: `https://${process.env.CAFE24_MALL_ID}.cafe24.com/board/${boardNo}/article/${article.article_no}`,
          synced_at: new Date().toISOString(),
          created_at: article.created_date || new Date().toISOString()
        }, {
          onConflict: 'cafe24_board_no,cafe24_article_no',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('[Cafe24] 게시글 저장 오류:', error);
        skipped++;
      } else {
        inserted++;
      }
    }

    // 마지막 동기화 시간 업데이트 (현재 환경변수에서는 무시)
    // .env로 변경되면서 관리 생략 (굳이 시간 저장 안해도 동작함)

    res.json({
      success: true,
      message: `동기화 완료: ${inserted}개 저장, ${skipped}개 오류`,
      inserted,
      skipped,
      total: articles.length
    });
  } catch (error) {
    console.error('[Cafe24] 동기화 오류:', error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data?.errors?.[0]?.message || error.message });
  }
});

// 카페24 연동 상태 확인
app.get('/api/cafe24/status', async (req, res) => {
  try {
    const settings = await getCafe24Settings();
    const isConnected = !!settings.access_token;
    const tokenExpired = settings.token_expires_at
      ? new Date(settings.token_expires_at) < new Date()
      : true;

    res.json({
      connected: isConnected && !tokenExpired,
      mall_id: process.env.CAFE24_MALL_ID,
      board_no: settings.board_no,
      last_synced_at: null,
      token_expired: tokenExpired
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// 카페24 답글 작성 (카페24로 전송)
app.post('/api/cafe24/boards/:boardNo/articles/:articleNo/comments', async (req, res) => {
  try {
    const settings = await getCafe24Settings();
    const token = await getValidToken(settings);
    const { boardNo, articleNo } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: '내용을 입력해주세요.' });
    }

    const resp = await axios.post(
      `https://${process.env.CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/boards/${boardNo}/articles/${articleNo}/comments`,
      { comment: { content } },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': '2024-06-01'
        }
      }
    );

    res.json({ success: true, comment: resp.data.comment });
  } catch (error) {
    console.error('[Cafe24] 댓글 작성 오류:', error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data?.errors?.[0]?.message || error.message });
  }
});

// =============================================
// 이카운트 ERP 세션 연동 및 테스트 라우트
// =============================================
const ecountService = require('./ecountService');

app.get('/api/ecount/status', async (req, res) => {
  try {
    const session = await ecountService.getValidEcountSession();
    if (session) {
      res.json({ connected: true, session_id: session.SESSION_ID.substring(0, 10) + '...' });
    } else {
      res.json({ connected: false });
    }
  } catch (error) {
    console.error('[ECount GET /api/ecount/status 오류]', error.message);
    res.status(500).json({ connected: false, error: '이카운트 연동에 실패했습니다. (아이디/API Key를 확인해주세요)' });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
}); 