require('dotenv').config({ path: 'server/.env' });

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  const b2bTag2 = encodeURIComponent('[B2B수기판매]');
  
  const url1 = `${supabaseUrl}/rest/v1/shipments?select=id,note&or=(note.is.null,and(note.not.ilike.*${b2bTag2}*))&limit=100`;
  const url2 = `${supabaseUrl}/rest/v1/shipments?select=id,note&and=(or(note.is.null,note.not.ilike.*${b2bTag2}*))&limit=100`;
  
  try {
     let res1 = await fetch(url1, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }});
     console.log("url1 ok?", res1.ok);
  } catch(e) { console.log(e); }
  
}

run();
