import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function checkAndRun() {
  console.log("Checking for shipments with empty location...");
  
  // First, check if there are any.
  // Note: RLS might block anon key update. We need to check if we can select them.
  const { data, error } = await supabase
    .from('shipments')
    .select('id, location')
    .or('location.is.null,location.eq.');
    
  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  
  console.log(`Found ${data ? data.length : 0} shipments with empty location.`);
  
  // Try to update one to test RLS
  if (data && data.length > 0) {
    const { error: updateError } = await supabase
      .from('shipments')
      .update({ location: '청담본점' })
      .or('location.is.null,location.eq.');
      
    if (updateError) {
      console.error("Error updating data (RLS might be blocking anon key):", updateError);
    } else {
      console.log(`Successfully updated ${data.length} shipments to '청담본점'.`);
    }
  }
}

checkAndRun();
