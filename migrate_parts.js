require('dotenv').config({ path: 'server/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const query = `
    ALTER TABLE shipment_parts ADD COLUMN IF NOT EXISTS status text DEFAULT '준비중';
    ALTER TABLE shipment_parts ADD COLUMN IF NOT EXISTS inventory_deducted boolean DEFAULT false;
    
    ALTER TABLE service_parts ADD COLUMN IF NOT EXISTS status text DEFAULT '준비중';
    ALTER TABLE service_parts ADD COLUMN IF NOT EXISTS inventory_deducted boolean DEFAULT false;

    UPDATE shipment_parts sp
    SET 
      status = CASE WHEN s.status IN ('출고대기', '출고완료') THEN '준비 완료' ELSE '준비중' END,
      inventory_deducted = CASE WHEN s.status IN ('출고대기', '출고완료') THEN true ELSE false END
    FROM shipments s
    WHERE sp.shipment_id = s.id AND sp.status = '준비중';

    UPDATE shipment_parts
    SET status = '반품 완료', inventory_deducted = false
    WHERE note LIKE '%[반품완료]%';

    UPDATE service_parts sp
    SET
      status = CASE WHEN s.status IN ('출고대기', '출고완료', '수령대기') THEN '준비 완료' ELSE '준비중' END,
      inventory_deducted = CASE WHEN s.status IN ('출고대기', '출고완료', '수령대기') THEN true ELSE false END
    FROM services s
    WHERE sp.service_id = s.id AND sp.status = '준비중';

    UPDATE service_parts
    SET status = '반품 완료', inventory_deducted = false
    WHERE usage LIKE '%[반품완료]%';
  `;
  // We can't run raw SQL directly with supabase-js unless we have a RPC.
  // Instead, let's just do it via fetching and iterating, or see if we have an RPC like execute_sql.
}
run();
