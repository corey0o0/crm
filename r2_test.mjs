import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// .env 로드
dotenv.config();

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.REACT_APP_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.REACT_APP_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_R2_SECRET_ACCESS_KEY,
  },
});

async function testUpload() {
  const fileName = `test_upload_${Date.now()}.txt`;
  // Prefix for key
  const key = `test/${fileName}`;
  const params = {
    Bucket: "crm-img", // 고정 버킷
    Key: key,
    Body: "Hello Cloudflare R2! This is a test file from the automated system.",
    ContentType: "text/plain",
  };

  try {
    console.log(`Cloudflare R2 버킷에 연결 중...`);
    console.log(`Endpoint: ${process.env.REACT_APP_R2_ENDPOINT}`);
    console.log(`업로드 키: ${key}`);
    
    await r2Client.send(new PutObjectCommand(params));
    
    const publicUrl = `${process.env.REACT_APP_R2_PUBLIC_URL}/${key}`;
    console.log("R2 업로드 성공!");
    console.log("성공적으로 업로드된 파일 접근 URL:", publicUrl);
  } catch (error) {
    console.error("R2 업로드 실패:", error);
  }
}

testUpload();
