const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getValidToken() {
  const { data, error } = await supabase
    .from('cafe24_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data.access_token;
}

async function checkOrder() {
  try {
    const token = await getValidToken();
    const mallId = process.env.REACT_APP_CAFE24_MALL_ID || 'xrider';
    const orderId = '20260405-0000032';

    const res = await axios.get(`https://${mallId}.cafe24api.com/api/v2/admin/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2024-03-01'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
checkOrder();
