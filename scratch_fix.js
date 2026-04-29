require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fix() {
  const { data: agency } = await supabase.from('agencies').select('id, name, cafe24_member_id').eq('name', '판매-청담본점-니어바이크').single();
  console.log('Agency:', agency);
  
  if (agency) {
    let newCafe24MemberId = agency.cafe24_member_id ? `${agency.cafe24_member_id}, nearbike0` : 'nearbike0';
    if (agency.cafe24_member_id && agency.cafe24_member_id.includes('nearbike0')) {
      newCafe24MemberId = agency.cafe24_member_id;
    }
    
    await supabase.from('agencies').update({ cafe24_member_id: newCafe24MemberId }).eq('id', agency.id);
    
    // Update cafe24_orders
    await supabase.from('cafe24_orders').update({ agency_id: agency.id }).eq('order_id', '20260423-0000064');
    
    // Update transactions
    await supabase.from('transactions').update({ to_location: agency.id, group_id: null, note: '[카페24 B2B 수동전송] 주문: 20260423-0000064 (출고처:청담본점)' }).like('note', '%20260423-0000064%');
    
    console.log('Fixed for nearbike0!');
  }
}
fix();
