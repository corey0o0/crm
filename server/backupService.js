const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

// R2 클라이언트 초기화
let r2Client = null;
if (process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// Supabase 테이블의 모든 행을 안전하게 가져오기 (Pagination 처리)
async function fetchEntireTable(supabaseAdmin, tableName) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  
  console.log(`[Backup] Fetching table: ${tableName}...`);
  while (true) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .range(from, from + pageSize - 1);
      
    if (error) {
      console.error(`[Backup Error] Error fetching table ${tableName}:`, error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    
    from += pageSize;
  }
  
  console.log(`[Backup] Table ${tableName} fetch complete. Total rows: ${allData.length}`);
  return allData;
}

// 5개 초과 분량의 오래된 백업 파일 삭제 로직
async function cleanOldBackups(bucketName) {
  try {
    const listCmd = new ListObjectsV2Command({ Bucket: bucketName, Prefix: 'db-backups/' });
    const response = await r2Client.send(listCmd);
    if (!response.Contents || response.Contents.length === 0) return;
    
    // 생성일자 기준 내림차순 정렬 (최신이 먼저)
    const files = response.Contents
      .filter(f => f.Key.endsWith('.json'))
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
    
    const MAX_FILES = 5;
    if (files.length > MAX_FILES) {
      console.log(`[Backup] Found ${files.length} backups. Retaining latest 5. Cleaning up old...`);
      for (let i = MAX_FILES; i < files.length; i++) {
        const delCmd = new DeleteObjectCommand({ Bucket: bucketName, Key: files[i].Key });
        await r2Client.send(delCmd);
        console.log(`[Backup] Deleted old backup: ${files[i].Key}`);
      }
    }
  } catch (err) {
    console.error(`[Backup Retention Error]`, err);
  }
}

// 메인 실행 함수
async function executeBackup(supabaseAdmin) {
  if (!r2Client) {
    console.log('[Backup] R2 Client variables missing in .env, skipping automatic backup.');
    return;
  }
  
  try {
    console.log('[Backup] Start JSON database collection...');
    
    // 주요 백업 대상 테이블 리스트
    const tablesToBackup = [
      'parts',
      'inventory',
      'warehouses',
      'transactions',
      'inventory_logs',
      'cafe24_orders',
      'pending_outbounds',
      'shipments',
      'shipment_parts',
      'board_metadata',
      'board_posts',
      'customers',
      'agencies',
      'as_requests',
      'cafe24_settings'
    ];
    
    const backupData = {
      _metadata: {
        timestamp: new Date().toISOString(),
        description: 'Auto-generated CRM Database JSON backup'
      }
    };
    
    // 모든 테이블 순차적으로 인출
    for (const tableName of tablesToBackup) {
      const records = await fetchEntireTable(supabaseAdmin, tableName);
      backupData[tableName] = records;
    }
    
    // JSON 문자열로 변환
    const jsonString = JSON.stringify(backupData);
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toISOString().split('T')[1].replace(/:/g, '-').slice(0, 8);
    const fileName = `db-backups/crm-backup-${dateStr}_${timeStr}.json`;
    const bucketName = process.env.R2_BUCKET_NAME || 'crm-storage';

    console.log(`[Backup] Collection complete. Uploading to R2 (${bucketName}/${fileName})...`);

    const putCmd = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: jsonString,
      ContentType: 'application/json'
    });
    
    await r2Client.send(putCmd);
    console.log(`[Backup] Upload Successful! (${jsonString.length} bytes)`);

    // 리텐션 관리 (5개 초과 삭제)
    await cleanOldBackups(bucketName);
    console.log(`[Backup] Backup routine complete.`);

  } catch (err) {
    console.error('[Backup Fatal Error]', err);
  }
}

module.exports = {
  executeBackup
};
