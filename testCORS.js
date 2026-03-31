require('dotenv').config();

async function testR2Cors() {
  const endpoint = process.env.REACT_APP_R2_ENDPOINT;
  const bucketUrl = `${endpoint}/crm-img/dummy.jpg`;
  
  console.log("Testing OPTIONS (Preflight) request to:", bucketUrl);

  const res = await fetch(bucketUrl, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "authorization,content-type,x-amz-content-sha256,x-amz-date,x-amz-user-agent"
    }
  });

  console.log("Status:", res.status);
  console.log("Headers:");
  res.headers.forEach((v, k) => console.log(k, ":", v));
}
testR2Cors();
