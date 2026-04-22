require('dotenv').config({ path: 'server/.env' });

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  const b2bTag2 = encodeURIComponent('[B2B수기판매]');
  const ecountTag = encodeURIComponent('과거 이카운트 이관');
  const b2bTag1 = encodeURIComponent('[B2B수기]');
  const manualTag = encodeURIComponent('[수기판매]');
  const excelTag = encodeURIComponent('[엑셀일괄등록]');
  const ecountNoteTag = encodeURIComponent('이카운트');
  
  const salesChannelFilter = `or(sales_channel.is.null,and(sales_channel.neq.${ecountTag},sales_channel.neq.${b2bTag1}))`;
  const noteFilter = `or(note.is.null,and(note.not.ilike.*${b2bTag2}*,note.not.ilike.*${manualTag}*,note.not.ilike.*${excelTag}*,note.not.ilike.*${ecountNoteTag}*))`;

  const url1 = `${supabaseUrl}/rest/v1/shipments?select=id,note,sales_channel&and=(${salesChannelFilter},${noteFilter})&limit=100`;
  // Test passing it simply as query params
  const url2 = `${supabaseUrl}/rest/v1/shipments?select=id,note,sales_channel&${salesChannelFilter}&${noteFilter}&limit=100`;
  
  try {
     let res1 = await fetch(url1, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }});
     let data1 = await res1.json();
     console.log("url1 size", data1.length);
     console.log("url1 parsed query ecount item?", data1.some(s => s.note && s.note.includes('이카운트')));
     
     let res2 = await fetch(url2, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }});
     let data2 = await res2.json();
     console.log("url2 size", data2.length);
     console.log("url2 parsed query ecount item?", data2.some(s => s.note && s.note.includes('이카운트')));
  } catch(e) { console.log(e); }
  
}

run();
