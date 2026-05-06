import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
console.log("URL:", supabaseUrl ? "Loaded" : "Missing");
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: shipments, error } = await supabase.from('shipments').select('id, status').order('created_at', { ascending: false }).limit(20);
  
  if (error) {
    console.error("Query Error:", error);
    return;
  }
  
  console.log(`Found ${shipments.length} shipments.`);
  if (shipments.length > 0) {
    console.log("Last 5 IDs:");
    shipments.slice(0, 5).forEach(s => console.log(s.id, s.status));
  }
}
check();
