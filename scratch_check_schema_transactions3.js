const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

async function check() {
  const { Client } = require('pg');
  // I don't have pg connection string. Let's see if the insert error is shown.
}
