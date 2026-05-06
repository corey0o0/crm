require('dotenv').config({ path: 'server/.env' });
const axios = require('axios');

async function test() {
  const url = process.env.SUPABASE_URL + '/rest/v1/?apikey=' + process.env.SUPABASE_SERVICE_KEY;
  // Let's just use the pg driver directly if I can install it, but I can't.
  // We can use Supabase postgrest endpoint.
}
test();
