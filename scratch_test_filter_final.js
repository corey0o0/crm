require('dotenv').config({ path: 'server/.env' });

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  const tag = encodeURIComponent('이카운트');
  const urlParams = `note=not.ilike.*${tag}*`;
  
  const url = `${supabaseUrl}/rest/v1/shipments?select=id,note&${urlParams}&limit=50`;
  
  const res = await fetch(url, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }});
  const data = await res.json();
  
  console.log("Returned:", data.length);
  console.log("Contains ecount?", data.some(s => s.note && s.note.includes('이카운트')));
}
run();
