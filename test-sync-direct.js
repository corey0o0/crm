const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const cafe24Router = require('./server/cafe24Router'); // I need to export syncCafe24OrdersCore to do this
