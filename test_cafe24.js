const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const cafe24Service = require('./server/cafe24Service');

async function testCafe24() {
    try {
        console.log("🚀 Testing Cafe24 API...");
        const result = await cafe24Service.getProducts();
        console.log(`✅ Success! Found ${result.length} products.`);
    } catch (e) {
        console.error("❌ Failed:", e.message);
        if (e.response && e.response.data) {
            console.error("Details:", JSON.stringify(e.response.data));
        }
    }
}
testCafe24();
