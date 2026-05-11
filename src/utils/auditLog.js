/**
 * 감사 로그(Audit Log) 유틸리티
 * 
 * 모든 주요 데이터 변경 작업을 기록합니다.
 * 로깅 실패는 원래 작업에 영향을 주지 않습니다 (fire-and-forget).
 */
import { supabase } from '../lib/supabaseClient';

/**
 * 감사 로그 기록
 * @param {Object} params
 * @param {string} params.action - 동작 유형 ('입고', '출고', '반품', '삭제', '수정', '등록', '취소' 등)
 * @param {string} params.targetTable - 대상 테이블 ('inventory_transactions', 'shipments', 'services', 'parts', 'agencies', 'customers')
 * @param {string|number} params.targetId - 대상 레코드 ID (삭제된 경우에도 기록)
 * @param {string} params.summary - 사람이 읽을 수 있는 요약 ("XRB-001 배터리 x 5개 본사→청담매장")
 * @param {Object} [params.details] - 변경 전/후 데이터 스냅샷 (JSONB)
 * @param {string} [params.groupId] - 그룹 작업 추적용 ID
 * @param {string} [params.userEmail] - 수행한 사용자 이메일 (자동 감지 가능)
 */
export async function logAction({ action, targetTable, targetId, summary, details = null, groupId = null, userEmail = null }) {
  try {
    // 사용자 이메일 자동 감지
    if (!userEmail) {
      const { data: { user } } = await supabase.auth.getUser();
      userEmail = user?.email || 'unknown';
    }

    const logEntry = {
      user_email: userEmail,
      action,
      target_table: targetTable,
      target_id: String(targetId || ''),
      summary: summary || '',
      details: details ? JSON.parse(JSON.stringify(details)) : null,
      group_id: groupId || null
    };

    const { error } = await supabase.from('audit_logs').insert(logEntry);

    if (error) {
      console.warn('[AuditLog] 로그 저장 실패:', error.message);
    }
  } catch (err) {
    // 로깅 실패가 원래 작업을 중단시키지 않도록 함
    console.warn('[AuditLog] 로그 기록 중 오류:', err.message);
  }
}

/**
 * 여러 로그를 한번에 기록 (배치)
 * @param {Array} logs - logAction 파라미터 배열
 */
export async function logActions(logs) {
  try {
    let userEmail = null;
    const { data: { user } } = await supabase.auth.getUser();
    userEmail = user?.email || 'unknown';

    const entries = logs.map(log => ({
      user_email: log.userEmail || userEmail,
      action: log.action,
      target_table: log.targetTable,
      target_id: String(log.targetId || ''),
      summary: log.summary || '',
      details: log.details ? JSON.parse(JSON.stringify(log.details)) : null,
      group_id: log.groupId || null
    }));

    const { error } = await supabase.from('audit_logs').insert(entries);
    if (error) {
      console.warn('[AuditLog] 배치 로그 저장 실패:', error.message);
    }
  } catch (err) {
    console.warn('[AuditLog] 배치 로그 기록 중 오류:', err.message);
  }
}

/**
 * 감사 로그 조회
 * @param {Object} filters
 * @param {string} [filters.action] - 동작 유형 필터
 * @param {string} [filters.targetTable] - 대상 테이블 필터
 * @param {string} [filters.userEmail] - 사용자 필터
 * @param {string} [filters.startDate] - 시작 날짜 (ISO)
 * @param {string} [filters.endDate] - 종료 날짜 (ISO)
 * @param {string} [filters.searchTerm] - 검색어 (summary 검색)
 * @param {number} [filters.limit] - 조회 건수 제한
 * @param {number} [filters.offset] - 페이지 오프셋
 * @returns {Promise<{data: Array, count: number}>}
 */
export async function fetchAuditLogs(filters = {}) {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.targetTable) {
      query = query.eq('target_table', filters.targetTable);
    }
    if (filters.userEmail) {
      query = query.eq('user_email', filters.userEmail);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate + 'T23:59:59');
    }
    if (filters.searchTerm) {
      query = query.ilike('summary', `%${filters.searchTerm}%`);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data || [], count: count || 0 };
  } catch (err) {
    console.error('[AuditLog] 로그 조회 실패:', err);
    return { data: [], count: 0 };
  }
}
