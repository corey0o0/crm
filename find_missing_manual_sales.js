import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

console.log("Supabase URL:", process.env.REACT_APP_SUPABASE_URL ? "Loaded" : "Not loaded");

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('shipments')
    .select('id, order_date, product_name, customer_name, sales_channel, note')
    .order('order_date', { ascending: false })
    .limit(100);
    
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  console.log("Total records fetched:", data ? data.length : 0);
  
  if (data && data.length > 0) {
      const potentialMisses = data.filter(r => {
        const hasManualTag = 
          (r.sales_channel === '과거 이카운트 이관') ||
          (r.sales_channel === '[B2B수기]') ||
          (r.sales_channel && r.sales_channel.includes('수기')) ||
          (r.sales_channel && r.sales_channel.includes('도매')) ||
          (r.note && r.note.includes('[B2B수기판매]')) ||
          (r.note && r.note.includes('[수기판매]'));
          
        if (hasManualTag) return false;
        
        const hasSalesChannelNote = r.note && r.note.includes('[판매처:');
        const isCustomerManual = r.customer_name === '수기판매';
        return hasSalesChannelNote || isCustomerManual;
      });
      
      console.log(`의심되는 누락 건: ${potentialMisses.length}건`);
      potentialMisses.forEach(m => {
        console.log(`- ID: ${m.id}, 제품: ${m.product_name}, 채널: ${m.sales_channel}, 메모: ${m.note}`);
      });
  }
}

check();
