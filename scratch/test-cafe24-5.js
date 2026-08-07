const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fextlagqverlrajlmkon.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error, count } = await supabase
    .from('cafe24_orders')
    .select('id, order_id, is_transferred, order_items', { count: 'exact' })
    .limit(3);
  console.log(JSON.stringify({ count, data, error }, null, 2));
}
run();
