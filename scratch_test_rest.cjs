require('dotenv').config({ path: 'server/.env' });

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  const b2bTag2 = encodeURIComponent('[B2B수기판매]');
  const ecountTag = encodeURIComponent('과거 이카운트 이관');
  const b2bTag1 = encodeURIComponent('[B2B수기]');
  const manualTag = encodeURIComponent('[수기판매]');
  const excelTag = encodeURIComponent('[엑셀일괄등록]');
  
  const salesChannelFilter = `or(sales_channel.is.null,and(sales_channel.neq.${ecountTag},sales_channel.neq.${b2bTag1}))`;
  // Test raw Korean for the ilike parameter
  const noteFilter = `or(note.is.null,and(note.not.ilike.*이카운트*,note.not.ilike.*${b2bTag2}*,note.not.ilike.*${manualTag}*,note.not.ilike.*${excelTag}*))`;

  const url = `${supabaseUrl}/rest/v1/shipments?select=id,note,sales_channel&and(${salesChannelFilter},${noteFilter})&limit=100`;
  
  console.log("Fetching: ", url);
  
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const data = await response.json();
  if (data.error) {
     console.error("Error:", data.error);
     return;
  }
  const ecountItems = data.filter(s => s.note && s.note.includes('이카운트'));
  
  console.log("Total received:", data.length);
  console.log("Found Ecount items inside the result?", ecountItems.length);
  if (ecountItems.length > 0) {
    console.log(ecountItems[0]);
  }
}

run();
