const cron = require('node-cron');
const { executeBackup } = require('./backupService');

module.exports = function(supabaseAdmin, cafe24Router) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true';

  if (!isProduction) {
    console.log('[Cron] 로컬 개발 환경이므로 백그라운드 스케줄러를 비활성화합니다. (다중 서버 갱신 경합 방지)');
    return;
  }

  // 매 정시마다 스케줄러 실행 (예: 0분 0초)
  // '* * * * *' -> 매분마다
  // '0 * * * *' -> 매시간 정각마다
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron Job] 카페24 주문 자동 수집 스케줄러를 시작합니다.');

    try {
      // 연동이 설정된 쇼핑몰 목록 가져오기
      const { data: malls, error } = await supabaseAdmin.from('cafe24_settings').select('*');
      
      if (error) {
        console.error('[Cron Job Error] 쇼핑몰 목록을 불러오지 못했습니다.', error);
        return;
      }

      if (!malls || malls.length === 0) {
        console.log('[Cron Job] 연동된 쇼핑몰이 없습니다.');
        return;
      }

      for (const mall of malls) {
        if (!mall.access_token) {
          console.log(`[Cron Job] ${mall.mall_id}: 연동되어 있지 않아 스킵합니다.`);
          continue;
        }

        // 파라미터가 없으면 내부적으로 과거 7일 기준으로 설정되지만,
        // 자주 수집하게 되므로 스케줄러에서는 넉넉하게 최근 3일을 기준으로만 수집하도록 합니다.
        const today = new Date();
        const pastDays = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
        const startDateStr = pastDays.toISOString().split('T')[0];
        const endDateStr = today.toISOString().split('T')[0];

        try {
          console.log(`[Cron Job] ${mall.mall_id} 몰의 주문 수집을 진행합니다...`);
          const result = await cafe24Router.syncCafe24OrdersCore(mall.mall_id, startDateStr, endDateStr);
          console.log(`[Cron Job] ${mall.mall_id} 수집 완료: 신규 ${result.totalInserted}건, 갱신 ${result.totalUpdated}건`);
        } catch (syncErr) {
          console.error(`[Cron Job Error] ${mall.mall_id} 몰 데이터 수집 중 오류:`, syncErr.message);
        }
      }

      console.log('[Cron Job] 카페24 전체 쇼핑몰 자동 수집 루프 완료.');

    } catch (err) {
      console.error('[Cron Job Fatal Error]', err);
    }
  });

  console.log('[Cron] 백그라운드 스케줄러(cronJobs)가 활성화되었습니다. (주기: 매시간 0분)');

  // 매일 새벽 4시 0분에 데이터베이스 백업 실행
  cron.schedule('0 4 * * *', async () => {
    console.log('[Cron Job] 자동 데이터 백업 스케줄러를 시작합니다.');
    await executeBackup(supabaseAdmin);
  });
  console.log('[Cron] 자동 백업 스케줄러가 활성화되었습니다. (주기: 매일 새벽 4시)');
};
