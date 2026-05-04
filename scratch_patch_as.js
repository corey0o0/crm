import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function patch() {
  console.log("Starting DB patch for A/S completion_date...");
  
  const { data: services, error: err1 } = await supabase
    .from('services')
    .select('id, updated_at, created_at')
    .eq('status', '완료')
    .is('completion_date', null);
    
  if (err1) {
    console.error("Error fetching services:", err1);
    return;
  }
  
  console.log(`Found ${services.length} services to patch.`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const s of services) {
    const { error: err2 } = await supabase
      .from('services')
      .update({ completion_date: s.updated_at || s.created_at })
      .eq('id', s.id);
      
    if (err2) {
      console.error(`Error updating id ${s.id}:`, err2);
      failCount++;
    } else {
      successCount++;
    }
  }
  
  console.log(`Patch completed. Success: ${successCount}, Fail: ${failCount}`);
}

patch();
