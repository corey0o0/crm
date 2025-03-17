# 영수증 분석 백엔드 서버

이 서버는 영수증 이미지나 PDF를 분석하여 상품명, 수량, 금액 정보를 추출하는 API를 제공합니다.

## 설치 방법

```bash
# 패키지 설치
npm install
```

## 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가합니다:

```
PORT=5000
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

실제 Anthropic API 키로 `your_anthropic_api_key_here`를 교체해야 합니다.

## 서버 실행

```bash
# 개발 모드로 실행 (nodemon 필요)
npm run dev

# 또는 일반 모드로 실행
npm start
```

서버는 기본적으로 5000번 포트에서 실행됩니다.

## API 엔드포인트

### 영수증 분석 API

**URL**: `/api/analyze-receipt`
**Method**: `POST`
**Content-Type**: `multipart/form-data`

**Request Body**:
- `file`: 영수증 이미지 또는 PDF 파일

**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "item_name": "상품명",
      "quantity": 1,
      "amount": 10000
    },
    ...
  ]
}
```

## 오류 처리

오류가 발생하면 다음과 같은 형식으로 응답합니다:

```json
{
  "error": "오류 메시지"
}
``` 