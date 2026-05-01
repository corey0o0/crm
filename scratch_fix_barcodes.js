const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data: parts, error } = await supabase.from('parts').select('id, barcode');
  if (error) {
    console.error(error);
    return;
  }
  
  let count = 0;
  for (const part of parts) {
    if (part.barcode && part.barcode !== part.barcode.trim()) {
      const trimmed = part.barcode.trim();
      await supabase.from('parts').update({ barcode: trimmed }).eq('id', part.id);
      count++;
    }
  }
  console.log(`Updated ${count} parts with trailing spaces in barcode.`);
})();
