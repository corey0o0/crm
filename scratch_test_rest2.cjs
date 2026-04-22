require('dotenv').config({ path: 'server/.env' });

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  // Just test note.not.ilike
  const url = `${supabaseUrl}/rest/v1/shipments?select=id,note&note=not.ilike.*${encodeURIComponent('이카운트')}*&limit=100`;
  
  console.log("Fetching: ", url);
  
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const data = await response.json();
  const ecountItems = data.filter(s => s.note && s.note.includes('이카운트'));
  
  console.log("Total received:", data.length);
  console.log("Found:", ecountItems.length);
}

run();
