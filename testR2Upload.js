require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.REACT_APP_R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.REACT_APP_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  const content = Buffer.from("hello world");
  const params = {
    Bucket: "crm-img",
    Key: "test_upload_from_node_123.txt",
    Body: content,
    ContentType: "text/plain",
  };

  console.log("Starting upload...");
  try {
    const data = await r2Client.send(new PutObjectCommand(params));
    console.log("Upload success!", data);
  } catch (err) {
    console.error("Upload error:", err);
  }
}

main();
