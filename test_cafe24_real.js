const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

async function getValidToken() {
  const CAFE24_ACCESS_TOKEN = process.env.CAFE24_ACCESS_TOKEN;
  if (!CAFE24_ACCESS_TOKEN) throw new Error("No token in .env");
  return CAFE24_ACCESS_TOKEN;
}

async function testProducts() {
  try {
    const token = await getValidToken();
    const resp = await axios.get(
      `https://${process.env.CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/products?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Cafe24-Api-Version': '2023-03-01'
        }
      }
    );
    console.log("Success:", resp.data.products.length);
  } catch(e) {
    console.log("Failed:", e.response?.data || e.message);
  }
}
testProducts();
