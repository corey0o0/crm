const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "https://fextlagqverlrajlmkon.supabase.co";
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('parts').select('id, discount_group').limit(1);
  if (error) console.error("Error:", error);
  else console.log("Success:", data);
}
check();
