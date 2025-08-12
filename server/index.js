const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const pdfPoppler = require('pdf-poppler');
const CloudmersiveConvertApiClient = require('cloudmersive-convert-api-client');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Cloudmersive API 클라이언트 설정
const cloudmersiveApiClient = new CloudmersiveConvertApiClient.ConvertDocumentApi();
// API 키 설정
const cloudmersiveApiKey = process.env.CLOUDMERSIVE_API_KEY || 'YOUR_API_KEY_HERE';
const defaultClient = CloudmersiveConvertApiClient.ApiClient.instance;
const Apikey = defaultClient.authentications['Apikey'];
Apikey.apiKey = cloudmersiveApiKey;

// CORS 설정
app.use(cors());
app.use(express.json());

// 헬스 체크 엔드포인트 추가
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '서버가 정상적으로 실행 중입니다.' });
});

// Anthropic API 키 설정
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

// OCR 엔진 선택 (환경 변수로 제어)
const useClaudeApi = process.env.USE_CLAUDE_API !== 'false'; // 기본값은 Claude API 사용

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
    
    // PDF를 이미지로 변환
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

// Claude API로 이미지 분석
async function analyzeImageWithClaude(imagePath, isPDF = false) {
  try {
    console.log(`Claude API로 이미지 분석 시작: ${imagePath}`);
    
    // 이미지를 base64로 인코딩
    const fileBuffer = fs.readFileSync(imagePath);
    const base64Data = fileBuffer.toString('base64');
    
    // 프롬프트 설정
    const promptText = isPDF 
      ? "이 PDF 영수증에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요. 형식: {\"items\": [{\"id\": 1, \"item_name\": \"상품명\", \"quantity\": 수량, \"amount\": 금액}, ...]}."
      : "이 영수증 이미지에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요. 형식: {\"items\": [{\"id\": 1, \"item_name\": \"상품명\", \"quantity\": 수량, \"amount\": 금액}, ...]}. 금액은 숫자만 추출해주세요.";
    
    // Claude API 호출
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ]
    });
    
    // 응답 처리
    let content = '';
    if (response.content && Array.isArray(response.content)) {
      const textContent = response.content.find(item => item.type === 'text');
      if (textContent) {
        content = textContent.text;
      }
    }
    
    // 백틱으로 감싸진 JSON 처리
    if (content.includes('```json')) {
      content = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      content = content.split('```')[1].split('```')[0].trim();
    }
    
    try {
      const parsedContent = JSON.parse(content);
      
      // 결과 형식 검증 및 보정
      if (!parsedContent.items || !Array.isArray(parsedContent.items)) {
        throw new Error('잘못된 응답 형식입니다.');
      }
      
      return parsedContent.items;
    } catch (parseError) {
      console.error('Claude API 응답 파싱 실패:', parseError);
      throw new Error('분석 결과 파싱에 실패했습니다.');
    }
  } catch (error) {
    console.error('Claude API 분석 실패:', error);
    throw error;
  }
}

// PDF를 이미지로 변환 후 Claude로 분석
async function analyzePdfWithClaudeViaImages(pdfPath) {
  try {
    // PDF를 이미지로 변환
    const imageFiles = await convertPdfToImage(pdfPath);
    
    if (imageFiles.length === 0) {
      throw new Error('PDF에서 이미지를 추출하지 못했습니다.');
    }
    
    // 모든 이미지에서 추출된 항목을 저장할 배열
    let allItems = [];
    let itemIdCounter = 1;
    
    // 각 이미지 페이지를 분석
    for (let i = 0; i < imageFiles.length; i++) {
      console.log(`PDF 페이지 ${i+1}/${imageFiles.length} 분석 중...`);
      
      // Claude API로 이미지 분석
      const items = await analyzeImageWithClaude(imageFiles[i], false);
      
      // ID 재할당하여 항목 추가
      const itemsWithNewIds = items.map(item => ({
        ...item,
        id: itemIdCounter++,
        page: i + 1 // 페이지 정보 추가
      }));
      
      allItems = [...allItems, ...itemsWithNewIds];
      
      // 임시 이미지 파일 삭제 (테스트를 위해 주석 처리)
      // fs.unlinkSync(imageFiles[i]);
      console.log(`변환된 이미지 파일 유지: ${imageFiles[i]}`);
    }
    
    return allItems;
  } catch (error) {
    console.error('PDF 이미지 변환 및 분석 실패:', error);
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

// 파일 업로드 및 OCR 처리 엔드포인트
app.post('/api/analyze-receipt', upload.single('file'), handleMulterError, async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }
    
    uploadedFilePath = req.file.path;

    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    
    // 지원되는 파일 형식 검증
    const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const isPDF = fileType === 'application/pdf';
    const isImage = supportedImageTypes.includes(fileType);
    
    if (!isPDF && !isImage) {
      // 임시 파일 삭제
      fs.unlinkSync(filePath);
      return res.status(400).json({ 
        error: '지원되지 않는 파일 형식입니다. JPEG, PNG, GIF, WebP 또는 PDF 파일만 지원합니다.' 
      });
    }

    // 파일 확장자 검증
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ 
        error: '지원되지 않는 파일 확장자입니다.' 
      });
    }

    // 매직 넘버로 실제 파일 타입 검증
    const fileBuffer = fs.readFileSync(filePath, { buffer: Buffer.alloc(16) });
    const magicNumbers = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header for WebP
      'application/pdf': [0x25, 0x50, 0x44, 0x46] // %PDF
    };

    let isValidFile = false;
    for (const [mimeType, signature] of Object.entries(magicNumbers)) {
      if (signature.every((byte, index) => fileBuffer[index] === byte)) {
        if (mimeType === fileType || (mimeType === 'image/jpeg' && fileType === 'image/jpg')) {
          isValidFile = true;
          break;
        }
      }
    }

    if (!isValidFile) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ 
        error: '파일 내용이 파일 형식과 일치하지 않습니다. 악성 파일일 가능성이 있습니다.' 
      });
    }
    
    // OCR 엔진 선택 (요청 파라미터로 오버라이드 가능)
    const useClaudeForThisRequest = req.query.useClaudeApi === 'true' ? true : 
                                   req.query.useClaudeApi === 'false' ? false : 
                                   useClaudeApi;
    
    // PDF 이미지 변환 옵션 (요청 파라미터로 제어)
    const convertPdfToImages = req.query.convertPdf === 'true';
    
    // Cloudmersive API 사용 여부
    const useCloudmersive = req.query.useCloudmersive === 'true';
    
    let items = [];
    let imageFiles = [];
    const startTime = Date.now();
    
    if (useClaudeForThisRequest) {
      // Claude API 사용
      console.log('Claude API 사용하여 OCR 처리 시작...');
      
      if (isPDF && convertPdfToImages) {
        // PDF를 이미지로 변환 후 Claude로 분석
        console.log('PDF를 이미지로 변환 후 Claude로 분석합니다...');
        
        try {
          // Cloudmersive API 또는 로컬 변환 사용
          if (useCloudmersive) {
            imageFiles = await convertPdfToImageWithCloudmersive(filePath);
          } else {
            imageFiles = await convertPdfToImage(filePath);
          }
          
          if (imageFiles.length > 0) {
            // 첫 번째 페이지만 분석
            const result = await analyzeImageWithClaude(imageFiles[0], true);
            items = result.items;
            
            // 이미지 URL 생성 (클라이언트에서 표시용)
            const imageUrls = imageFiles.map(file => {
              const relativePath = path.relative(__dirname, file);
              return `/api/uploads/${path.basename(file)}`;
            });
            
            // 처리 시간 계산
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            // 결과 반환
            return res.json({ 
              items, 
              images: imageUrls,
              processingTime
            });
          }
        } catch (pdfError) {
          console.error('PDF 변환 실패, 직접 Claude API로 전송합니다:', pdfError);
          // PDF 변환 실패 시 직접 Claude API로 전송
        }
      }
      
      // 파일을 base64로 인코딩
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      
      // 프롬프트 설정
      const promptText = isPDF 
        ? "이 PDF 영수증에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요. 형식: {\"items\": [{\"id\": 1, \"item_name\": \"상품명\", \"quantity\": 수량, \"amount\": 금액}, ...]}."
        : "이 영수증 이미지에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요. 형식: {\"items\": [{\"id\": 1, \"item_name\": \"상품명\", \"quantity\": 수량, \"amount\": 금액}, ...]}. 금액은 숫자만 추출해주세요.";
      
      // Claude API 호출
      const response = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.5,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: isImage ? fileType : 'application/pdf',
                  data: base64Data
                }
              }
            ]
          }
        ]
      });
      
      // 응답 처리
      let content = '';
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(item => item.type === 'text');
        if (textContent) {
          content = textContent.text;
        }
      }
      
      // 백틱으로 감싸진 JSON 처리
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }
      
      try {
        const parsedContent = JSON.parse(content);
        
        // 결과 형식 검증 및 보정
        if (!parsedContent.items || !Array.isArray(parsedContent.items)) {
          throw new Error('잘못된 응답 형식입니다.');
        }
        
        // 각 항목의 필수 필드 확인 및 보정
        items = parsedContent.items.map((item, index) => ({
          id: item.id || index + 1,
          item_name: item.item_name || '알 수 없는 상품',
          quantity: item.quantity || 1,
          amount: parseFloat(String(item.amount).replace(/[^0-9.]/g, '')) || 0
        }));
      } catch (parseError) {
        console.error('Claude API 응답 파싱 실패:', parseError);
        throw new Error('분석 결과 파싱에 실패했습니다.');
      }
      
      // 처리 시간 계산
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // 결과에 처리 시간 추가
      return res.json({ 
        items, 
        images: imageFiles.map(file => `/api/uploads/${path.basename(file)}`),
        processingTime
      });
    } else {
      throw new Error('Tesseract OCR 사용이 비활성화되었습니다.');
    }
  } catch (error) {
    console.error('OCR 처리 중 오류 발생:', error);
    return res.status(500).json({ error: `OCR 처리 중 오류가 발생했습니다: ${error.message}` });
  }
});

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

// 재귀 호출을 위한 별도 함수 정의
async function handleAnalyzeReceipt(req, res) {
  // 파일 업로드 미들웨어 실행
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: '파일 업로드 오류: ' + err.message });
    }
    
    // 원래 라우트 핸들러와 동일한 로직 실행
    try {
      if (!req.file) {
        return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
      }
  
      const filePath = req.file.path;
      const fileType = req.file.mimetype;
      
      // 지원되는 파일 형식 검증
      const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const isPDF = fileType === 'application/pdf';
      const isImage = supportedImageTypes.includes(fileType);
      
      if (!isPDF && !isImage) {
        // 임시 파일 삭제
        fs.unlinkSync(filePath);
        return res.status(400).json({ 
          error: '지원되지 않는 파일 형식입니다. JPEG, PNG, GIF, WebP 또는 PDF 파일만 지원합니다.' 
        });
      }
      
      // OCR 엔진 선택 (요청 파라미터로 오버라이드 가능)
      const useClaudeForThisRequest = req.query.useClaudeApi === 'true';
      
      let items = [];
      
      // Claude API 사용 (재귀 호출에서는 항상 Claude API 사용)
      console.log('Claude API 사용하여 OCR 처리 시작... (fallback)');
      
      // 파일을 base64로 인코딩
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      
      // 프롬프트 설정
      const promptText = isPDF 
        ? "이 PDF 영수증에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요. 형식: {\"items\": [{\"id\": 1, \"item_name\": \"상품명\", \"quantity\": 수량, \"amount\": 금액}, ...]}."
        : "이 영수증 이미지에서 다음 정보를 추출해주세요: 상품명, 수량, 금액. JSON 형식으로 응답해주세요. 형식: {\"items\": [{\"id\": 1, \"item_name\": \"상품명\", \"quantity\": 수량, \"amount\": 금액}, ...]}. 금액은 숫자만 추출해주세요.";
      
      // Claude API 호출
      const response = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.5,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: isImage ? fileType : 'application/pdf',
                  data: base64Data
                }
              }
            ]
          }
        ]
      });
      
      // 응답 처리
      let content = '';
      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find(item => item.type === 'text');
        if (textContent) {
          content = textContent.text;
        }
      }
      
      // 백틱으로 감싸진 JSON 처리
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }
      
      try {
        const parsedContent = JSON.parse(content);
        
        // 결과 형식 검증 및 보정
        if (!parsedContent.items || !Array.isArray(parsedContent.items)) {
          throw new Error('잘못된 응답 형식입니다.');
        }
        
        // 각 항목의 필수 필드 확인 및 보정
        items = parsedContent.items.map((item, index) => ({
          id: item.id || index + 1,
          item_name: item.item_name || '알 수 없는 상품',
          quantity: item.quantity || 1,
          amount: parseFloat(String(item.amount).replace(/[^0-9.]/g, '')) || 0
        }));
      } catch (parseError) {
        console.error('Claude API 응답 파싱 실패:', parseError);
        throw new Error('분석 결과 파싱에 실패했습니다.');
      }
      
      // 임시 파일 삭제
      fs.unlinkSync(filePath);
      
      return res.json({ items });
      
    } catch (error) {
      console.error('서버 오류 (fallback):', error);
      
      // 임시 파일이 존재하면 삭제
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({ error: error.message });
    }
  });
}

// 서버 시작
app.listen(port, () => {
  console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`OCR 엔진: ${useClaudeApi ? 'Claude API (기본)' : 'Tesseract OCR (기본)'}`);
  console.log('환경 변수 USE_CLAUDE_API를 설정하여 기본 OCR 엔진을 변경할 수 있습니다.');
  console.log('요청 파라미터 useClaudeApi=true/false로 개별 요청의 OCR 엔진을 지정할 수 있습니다.');
  console.log('요청 파라미터 convertPdf=true로 PDF를 이미지로 변환 후 분석할 수 있습니다.');
}); 