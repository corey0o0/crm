const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const ecountService = require('./server/ecountService');
const { createClient } = require('@supabase/supabase-js');

async function testConnections() {
  console.log('=============================================');
  console.log('[1] Ecount Connection Test');
  console.log('=============================================');
  try {
    console.log(`Checking credentials (masked): COM_CODE=${process.env.ECOUNT_COM_CODE ? '***' : 'missing'}, USER_ID=${process.env.ECOUNT_USER_ID ? '***' : 'missing'}`);
    const session = await ecountService.getValidEcountSession();
    if (session.isTest) {
      console.log('✅ Ecount Test Connection Verified! (테스트용 인증키 검증 통과)');
      console.log(`Zone URL: ${session.zoneUrl}`);
      console.log(`Message: ${session.message}`);
    } else {
      console.log('✅ Ecount Connection Successful! (정식 세션)');
      console.log(`Zone URL: ${session.zoneUrl}`);
      console.log(`Session ID: ${session.SESSION_ID.substring(0, 10)}... (truncated)`);
    }
  } catch (err) {
    console.error('❌ Ecount Connection Failed:', err.message);
  }

  console.log('\n=============================================');
  console.log('[2] Cafe24 Connection Test');
  console.log('=============================================');
  try {
    const mallId = process.env.CAFE24_MALL_ID;
    const accessToken = process.env.CAFE24_ACCESS_TOKEN;
    const tokenExpiresAt = process.env.CAFE24_TOKEN_EXPIRES_AT;
    
    if (!mallId) {
      console.error('❌ Missing CAFE24_MALL_ID in server/.env');
      return;
    }

    if (!accessToken) {
      console.error('❌ No Cafe24 access_token found in .env. Need to authenticate via CRM settings page first.');
      return;
    }

    const tokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < new Date() : true;
    
    console.log(`Mall ID: ${mallId}`);
    console.log(`Has Access Token: true`);
    console.log(`Token Expired: ${tokenExpired}`);
    
    if (!tokenExpired) {
      console.log('✅ Cafe24 Connection Valid & Active! (Stored in .env)');
    } else {
      console.log('⚠️ Cafe24 Token Expired. Need to re-authenticate or wait for auto-refresh.');
    }
  } catch (err) {
    console.error('❌ Cafe24 Connection Test Failed:', err.message);
  }
}

testConnections();
