require("dotenv").config();
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3");

const initR2Client = () => {
  return new S3Client({
    region: "auto",
    endpoint: process.env.REACT_APP_R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.REACT_APP_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.REACT_APP_R2_SECRET_ACCESS_KEY,
    },
  });
};

async function main() {
  const s3 = initR2Client();
  const bucket = "crm-img"; // from the source code
  
  try {
    const cors = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log("Current CORS:", JSON.stringify(cors.CORSRules, null, 2));
  } catch (err) {
    console.log("No CORS or error:", err.message);
  }

  const putCors = new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedOrigins: ["*"], // in production, replace with actual origin
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000
        }
      ]
    }
  });

  try {
    await s3.send(putCors);
    console.log("CORS updated applied successfully.");
  } catch (err) {
    console.error("Failed to apply CORS:", err);
  }
}

main();
