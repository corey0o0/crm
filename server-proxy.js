const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PROXY_PORT || 3001;

// CORS 설정
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Claude API 프록시 엔드포인트
app.post('/api/claude', async (req, res) => {
  try {
    console.log('Claude API 프록시 요청 수신');
    
    // API 키 확인
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.REACT_APP_CLAUDE_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 설정해주세요.' 
      });
    }
    
    // Claude API 호출
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      data: req.body,
      maxBodyLength: Infinity
    });
    
    // 응답 반환
    res.json(response.data);
    
  } catch (error) {
    console.error('Claude API 프록시 오류:', error.response?.data || error.message);
    
    // 오류 응답 반환
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`프록시 서버가 포트 ${port}에서 실행 중입니다.`);
  console.log('이 서버는 CORS 문제를 해결하기 위한 프록시 역할을 합니다.');
  console.log('클라이언트에서 http://localhost:3001/api/claude로 요청을 보내면 Claude API로 중계됩니다.');
}); 