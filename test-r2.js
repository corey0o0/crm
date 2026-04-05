const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const client = new S3Client({
    region: "auto",
    endpoint: "https://96ba0f2d17dc20c48b603cb089d3a151.r2.cloudflarestorage.com",
    forcePathStyle: true,
    credentials: {
      accessKeyId: "647a998ddc16821a15385abbeaf4e16c",
      secretAccessKey: "b0a8674d53482cc78721d0ccbf92c028cb0406c98f731cb706a8911115ec4f3c",
    },
});

async function main() {
    try {
        const params = { Bucket: "crm-img", Key: "test_upload.txt", Body: "Hello R2", ContentType: "text/plain" };
        const res = await client.send(new PutObjectCommand(params));
        console.log("Success:", res);
    } catch(err) {
        console.error("Error:", err);
    }
}
main();
