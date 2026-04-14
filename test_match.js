const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function run() {
  const { data: parts } = await supabase.from('parts').select('id, name, code');
  const csvStr = fs.readFileSync('data_detailed.csv', 'utf8');
  const lines = csvStr.split('\n').filter(l => l.trim() && !l.startsWith('회사명') && !l.startsWith('일자'));
  
  let matchCount = 0;
  let missing = new Set();

  for (const line of lines) {
    const cols = line.match(/(?:\"([^\"]*)\"|([^,]*))/g).map(c => c.replace(/^"|"$/g, ''));
    if (cols.length < 11) continue;
    const name = cols[1];
    if (name === '배송비' || name.includes('개인결제건')) continue;
    
    // basic matching logic
    const matched = parts.find(p => name.includes(p.name) || (p.code && name.includes(p.code)));
    if (matched) matchCount++;
    else missing.add(name);
  }
  
  console.log(`Matched: ${matchCount}, Missing types: ${missing.size}`);
  console.log("Sample missing:", Array.from(missing).slice(0, 5));
}
run();
