import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fextlagqverlrajlmkon.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleHRsYWdxdmVybHJhamxta29uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc2MTA5OCwiZXhwIjoyMDU2MzM3MDk4fQ.lVnEzdCfKvQdge8Ywfje33Ab10kcN8jL7_K9XLi0KuI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDatabaseUsage() {
  const tablesToCheck = [
    'orders',
    'inventory_logs',
    'sales_history',
    'parts',
    'customers',
    'transactions'
  ];

  console.log('Estimating Database Size based on Row Counts...');
  for (const table of tablesToCheck) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`Table ${table} error: ${error.message}`);
    } else {
      console.log(`Table ${table}: ${count} rows`);
    }
  }
}

checkDatabaseUsage();
