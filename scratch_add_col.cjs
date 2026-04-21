require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { error } = await supabaseAdmin.auth.admin.createUser({ email: 'dummy' }); // just to check connection
  // Actually we can't alter table via supabase-js without postgres function or raw SQL query
  // Wait, I can use postgres connection using PG uri if I have it, or I can use the `server/test_db.js` strategy.
}
run();
