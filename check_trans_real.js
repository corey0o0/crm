const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: 'server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .ilike('note', '%20260417-0000173%');
  
  console.log('173:', data);
  
  const { data: data2 } = await supabase
    .from('transactions')
    .select('*')
    .ilike('note', '%20260417-0000246%');
    
  console.log('246:', data2);
}
check();
