const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data } = await supabase.from('parts').select('brand');
  console.log([...new Set(data.map(d => d.brand).filter(b => b))]);
})();
