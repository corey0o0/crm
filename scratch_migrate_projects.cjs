require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: shipments, error } = await supabaseAdmin.from('shipments')
      .select('id, note, sales_channel, customer_name')
      .ilike('note', '%[프로젝트:%');

  if (error) {
      console.error(error);
      return;
  }
  
  let updatePromises = [];
  let updatedCount = 0;

  for (const row of shipments) {
      const match = row.note.match(/\[프로젝트:(.*?)\]/);
      if (match) {
          const rawProject = match[1].trim();
          let newChannel = null;

          if (rawProject.includes('일반') && rawProject.includes('온라인판매')) {
              newChannel = '온라인주문'; // 온라인판매로 집계 되도록
          } else if (rawProject.includes('대리점')) {
              newChannel = row.customer_name; // 기존의 다른 건과 동일하게 거래처명으로
          } else if (rawProject.includes('일반')) {
              newChannel = '고객';
          }
          
          if (newChannel && newChannel !== row.sales_channel) {
              updatePromises.push(supabaseAdmin.from('shipments').update({ sales_channel: newChannel }).eq('id', row.id));
              updatedCount++;
          }
      }
  }

  await Promise.all(updatePromises);
  console.log("Migration complete! Updated", updatedCount, "records back to new rules based on project name.");
}

run();
