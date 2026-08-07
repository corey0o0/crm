const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://fextlagqverlrajlmkon.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3NjEwOTgsImV4cCI6MjA1NjMzNzA5OH0.3EpsSNquIukHRgNmPCUIVyC6YKVMXh9RBEP8kM_m9c4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase
    .from('service_parts')
    .select(`
      price,
      quantity,
      usage,
      services!inner ( id, completion_date, brand ),
      parts!inner ( name, code, note )
    `)
    .in('service_id', [5672, 5737]);
    
  if (data) {
    data.forEach(item => {
      let returnedQty = 0;
      if (item.usage && item.usage.includes('[반품완료]')) {
        returnedQty = item.quantity;
      } else if (item.usage && item.usage.includes('[부분반품:')) {
        const matches = item.usage.match(/\[부분반품:(\d+)개\]/g);
        if (matches) {
          matches.forEach(m => {
            const qtyMatch = m.match(/\[부분반품:(\d+)개\]/);
            if (qtyMatch && qtyMatch[1]) {
              returnedQty += parseInt(qtyMatch[1], 10);
            }
          });
        }
      }
      const effectiveQty = Math.max(0, (item.quantity || 0) - returnedQty);
      console.log(`Service ID: ${item.services.id}, Name: ${item.parts.name}, Usage: ${item.usage}`);
      console.log(`Original Qty: ${item.quantity}, Returned Qty: ${returnedQty}, Effective Qty: ${effectiveQty}`);
      console.log('---');
    });
  }
}
run();
