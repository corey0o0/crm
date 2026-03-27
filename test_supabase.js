const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing URL or Key in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  try {
    console.log(`Connecting to ${url}...`);
    const { data, error } = await supabase.from('services').select('id').limit(1);
    
    if (error) {
      console.error('Query Error:', error);
    } else {
      console.log('Query Success. Supabase is online.');
      console.log('Data:', data);
    }
  } catch (err) {
    console.error('Connection Exception:', err);
  }
}

testConnection();
