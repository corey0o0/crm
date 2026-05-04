import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { processServiceCompletion } from './src/utils/inventoryUtils.js';

dotenv.config({ path: '.env.local' });
if (!process.env.REACT_APP_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

async function testAS() {
  console.log("Testing A/S Completion...");
  try {
    // Call processServiceCompletion with dummy data but we need an actual serviceId.
    // Let's just find an existing service and try to trigger it, but that might alter data.
    // So let's just log what we have.
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    console.log("Supabase URL configured:", !!supabaseUrl);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testAS();
