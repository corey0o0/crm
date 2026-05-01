const { createClient } = require('@supabase/supabase-js');

// These are the values from index.html / env.js
const supabaseUrl = 'https://fextlagqverlrajlmkon.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('cafe24_orders')
    .select('id, is_transferred, is_deleted')
    .eq('is_transferred', true)
    .limit(10);
  console.log(JSON.stringify({ data, error }, null, 2));
}
run();
