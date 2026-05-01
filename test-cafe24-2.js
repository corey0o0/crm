const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://fextlagqverlrajlmkon.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, is_transferred, order_items, is_deleted')
    .eq('is_transferred', true)
    .limit(3);
    
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(error);
  }
}
run();
