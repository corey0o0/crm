const { syncCafe24OrdersCore } = require('./server/cafe24Router');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('access_token').eq('mall_id', 'slimpack79').single();
  
  // mock req and res
  const express = require('express');
  const app = express();
  const router = require('./server/cafe24Router');
  
  const token = mall.access_token;
  
  // Actually, I can just require the file and extract the function. Wait, syncCafe24OrdersCore is NOT exported!
  // I need to copy the function or modify the router.
}
run();
