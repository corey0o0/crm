const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

// 1. 환경 변수 확인 (GitHub Actions에서 주입됨)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'crm-storage';

const missingVars = [];
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!SUPABASE_KEY) missingVars.push('SUPABASE_SERVICE_KEY');
if (!R2_ACCESS_KEY_ID) missingVars.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missingVars.push('R2_SECRET_ACCESS_KEY');
if (!R2_ENDPOINT) missingVars.push('R2_ENDPOINT');

if (missingVars.length > 0) {
  console.error(`❌ 필수 환경 변수가 누락되었습니다: ${missingVars.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// 백업할 전체 테이블 목록
const TABLES = [
  'parts', 'warehouses', 'dealers', 'model_settings', 'brand_settings', 
  'user_memos', 'board_posts', 'services', 'shipments', 'inventory', 
  'transactions', 'service_tags', 'service_parts',
  'pending_orders', 'pending_outbounds', 'cafe24_orders',
  'inventory_logs', 'customers', 'sales_history', 'orders'
];

async function runBackup() {
  console.log("🚀 Supabase 데이터베이스 자동 백업 시작...");
  const backupData = {
    timestamp: new Date().toISOString(),
    version: '1.1',
    tables: {}
  };

  let totalRecords = 0;

  for (const table of TABLES) {
    console.log(`⏳ 백업 중: ${table}...`);
    let allData = [];
    let offset = 0;
    const limit = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) {
        // 테이블이 존재하지 않는 경우 에러 무시
        if (error.code === '42P01') {
           console.log(`⚠️ 테이블 ${table}이 존재하지 않습니다 (건너뜀).`);
        } else {
           console.error(`❌ 테이블 ${table} 백업 실패:`, error.message);
        }
        fetchMore = false;
        break;
      }
      
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < limit) {
          fetchMore = false;
        } else {
          offset += limit;
        }
      } else {
        fetchMore = false;
      }
    }
    
    if (allData.length > 0) {
      backupData.tables[table] = { data: allData };
      totalRecords += allData.length;
      console.log(`✅ ${table}: ${allData.length}건 백업 완료`);
    }
  }

  backupData.metadata = {
    totalTables: Object.keys(backupData.tables).length,
    totalRecords: totalRecords
  };

  // 임시 JSON 문자열 생성
  const timestamp = new Date().toISOString().split('T')[0];
  const fileName = `database_backups/crm_backup_${timestamp}_${Date.now()}.json`;
  const fileContent = JSON.stringify(backupData, null, 2);

  console.log(`\n☁️ Cloudflare R2 스토리지 업로드 중...`);
  
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    console.log(`🎉 백업 완료! R2에 저장됨: ${fileName} (${totalRecords} records)`);
  } catch (error) {
    console.error("❌ R2 업로드 실패:", error);
    process.exit(1);
  }
}

runBackup();
