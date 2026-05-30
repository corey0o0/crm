import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, TableContainer, Table,
  TableHead, TableBody, TableRow, TableCell, TextField, MenuItem, CircularProgress,
  Chip, Tabs, Tab, Divider, LinearProgress, Tooltip
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Build as BuildIcon, AttachMoney as MoneyIcon, LocalOffer as TagIcon,
  Assessment as AssessmentIcon, Schedule as ScheduleIcon, TrendingUp as TrendingUpIcon,
  Warning as WarningIcon, Person as PersonIcon
} from '@mui/icons-material';
import { supabase } from '../../lib/supabaseClient';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, differenceInDays } from 'date-fns';
import { groupServicesByKeyword } from '../../utils/symptomTagUtils';
import { generateCorrelationInsights } from '../../utils/aiAnalysisUtils';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#0288d1', '#558b2f'];
const COMPLETED_STATUSES = ['출고완료', '완료', '수령완료'];

const getEffectiveQty = (part) => {
  let returnedQty = 0;
  const usage = part.usage || '';
  if (usage.includes('[반품완료]')) {
    returnedQty = part.quantity || 0;
  } else if (usage.includes('[부분반품:')) {
    const matches = usage.match(/\[부분반품:(\d+)개\]/g);
    if (matches) matches.forEach(m => {
      const qm = m.match(/\[부분반품:(\d+)개\]/);
      if (qm?.[1]) returnedQty += parseInt(qm[1], 10);
    });
  }
  return Math.max(0, (part.quantity || 0) - returnedQty);
};

const getTags = (s) => (s.service_tags || []).map(t => t.tag_name);

const fmt = (n) => n.toLocaleString();
const fmtWon = (n) => `${Math.round(n / 10000)}만원`;

const calcRange = (months) => {
  const end = endOfMonth(new Date());
  const start = startOfMonth(subMonths(end, months - 1));
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
};

function ServiceStats() {
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('전체');
  const [tabValue, setTabValue] = useState(0);
  const [services, setServices] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [correlationInsight, setCorrelationInsight] = useState('');
  const [correlationLoading, setCorrelationLoading] = useState(false);
  const init = calcRange(6);
  const [filterStart, setFilterStart] = useState(init.start);
  const [filterEnd, setFilterEnd] = useState(init.end);

  const setPeriod = (months) => {
    const r = calcRange(months);
    setFilterStart(r.start);
    setFilterEnd(r.end);
  };

  useEffect(() => { fetchServiceStats(); }, [selectedBrand, filterStart, filterEnd]);

  const fetchServiceStats = async () => {
    setLoading(true);
    try {
      let mainQuery = supabase
        .from('services')
        .select('id, reception_date, completion_date, created_at, customer_name, brand, status, reception_type, symptom, solution, service_tags(tag_name), service_parts(price, quantity, usage, parts(name, code, cost_price))')
        .gte('reception_date', filterStart)
        .lte('reception_date', filterEnd);

      let backlogQuery = supabase
        .from('services')
        .select('id, reception_date, status')
        .not('status', 'in', `("${COMPLETED_STATUSES.join('","')}")`)
        .order('reception_date', { ascending: true })
        .limit(300);

      if (selectedBrand !== '전체') {
        mainQuery = mainQuery.eq('brand', selectedBrand);
        backlogQuery = backlogQuery.eq('brand', selectedBrand);
      }

      const [{ data: svcData, error }, { data: blData }] = await Promise.all([mainQuery, backlogQuery]);
      if (error) throw error;

      setServices(svcData || []);
      setBacklog(blData || []);
    } catch (err) {
      console.error('통계 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── 기본 파생 데이터 ──────────────────────────────────────────
  const completedServices = useMemo(() =>
    services.filter(s => COMPLETED_STATUSES.includes(s.status)), [services]);

  const keywordCorrelationData = useMemo(() =>
    groupServicesByKeyword(completedServices.filter(s => s.symptom && s.solution)),
  [completedServices]);

  const totalAmount = useMemo(() =>
    completedServices.reduce((sum, s) =>
      sum + (s.service_parts || []).reduce((ps, p) => ps + (p.price || 0) * getEffectiveQty(p), 0), 0),
  [completedServices]);

  const avgProcessingTime = useMemo(() => {
    let total = 0, count = 0;
    completedServices.forEach(s => {
      if (!s.reception_date || !s.completion_date) return;
      const days = differenceInDays(new Date(s.completion_date), new Date(s.reception_date));
      if (days >= 0) { total += days; count++; }
    });
    return count > 0 ? (total / count) : 0;
  }, [completedServices]);

  // ── 탭 1: 월별 ─────────────────────────────────────────────
  const monthlyStats = useMemo(() => {
    return eachMonthOfInterval({ start: parseISO(filterStart), end: parseISO(filterEnd) }).map(month => {
      const key = format(month, 'yyyy-MM');
      const monthSvcs = services.filter(s => {
        const d = s.reception_date || s.created_at;
        return d && format(parseISO(d), 'yyyy-MM') === key;
      });
      const completed = monthSvcs.filter(s => COMPLETED_STATUSES.includes(s.status));
      return {
        month: key,
        label: format(month, 'M월'),
        count: monthSvcs.length,
        amount: completed.reduce((sum, s) =>
          sum + (s.service_parts || []).reduce((ps, p) => ps + (p.price || 0) * getEffectiveQty(p), 0), 0)
      };
    });
  }, [services, filterStart, filterEnd]);

  const tagStats = useMemo(() => {
    const counts = {};
    services.forEach(s => getTags(s).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count, pct: (count / services.length * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count).slice(0, 15);
  }, [services]);

  const tagPartCorrelation = useMemo(() => {
    const map = {};
    services.forEach(s => {
      const tags = getTags(s);
      if (tags.length === 0) return;
      const activeParts = (s.service_parts || []).filter(sp => getEffectiveQty(sp) > 0);
      tags.forEach(tag => {
        if (!map[tag]) map[tag] = { tag, total: 0, parts: {} };
        map[tag].total++;
        activeParts.forEach(sp => {
          const name = sp.parts?.name;
          if (!name) return;
          map[tag].parts[name] = (map[tag].parts[name] || 0) + 1;
        });
      });
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map(r => ({
        ...r,
        topParts: Object.entries(r.parts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      }));
  }, [services]);

  // ── 탭 4: 부품 소모 순위 + 모델별 패턴 ────────────────────
  const partsStats = useMemo(() => {
    const map = {};
    completedServices.forEach(s => {
      (s.service_parts || []).forEach(sp => {
        const name = sp.parts?.name || '미분류';
        const qty = getEffectiveQty(sp);
        if (!map[name]) map[name] = { name, count: 0, revenue: 0, cost: 0 };
        map[name].count += qty;
        map[name].revenue += (sp.price || 0) * qty;
        map[name].cost += (sp.parts?.cost_price || 0) * qty;
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [completedServices]);

  const modelStats = useMemo(() => {
    const map = {};
    services.forEach(s => {
      const brand = s.brand || '미분류';
      if (!map[brand]) map[brand] = { brand, count: 0, tags: {}, types: {} };
      map[brand].count++;
      getTags(s).forEach(t => { map[brand].tags[t] = (map[brand].tags[t] || 0) + 1; });
      if (s.reception_type) map[brand].types[s.reception_type] = (map[brand].types[s.reception_type] || 0) + 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).map(m => ({
      ...m,
      topTags: Object.entries(m.tags).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topTypes: Object.entries(m.types).sort((a, b) => b[1] - a[1]).slice(0, 3),
    }));
  }, [services]);

  // ── 탭 5: 처리 시간 분포 + 백로그 ─────────────────────────
  const processingTimeStats = useMemo(() => {
    const buckets = [
      { label: '당일', min: 0, max: 0, count: 0 },
      { label: '1-3일', min: 1, max: 3, count: 0 },
      { label: '4-7일', min: 4, max: 7, count: 0 },
      { label: '8-14일', min: 8, max: 14, count: 0 },
      { label: '15일+', min: 15, max: Infinity, count: 0 },
    ];
    completedServices.forEach(s => {
      if (!s.reception_date || !s.completion_date) return;
      const days = differenceInDays(new Date(s.completion_date), new Date(s.reception_date));
      const bucket = buckets.find(b => days >= b.min && days <= b.max);
      if (bucket) bucket.count++;
    });
    const total = buckets.reduce((s, b) => s + b.count, 0);
    return buckets.map(b => ({ ...b, pct: total > 0 ? (b.count / total * 100).toFixed(1) : '0.0' }));
  }, [completedServices]);

  const backlogWithDays = useMemo(() =>
    backlog.map(s => ({
      ...s,
      waitDays: s.reception_date ? differenceInDays(new Date(), new Date(s.reception_date)) : null,
    })).sort((a, b) => (b.waitDays ?? 0) - (a.waitDays ?? 0)),
  [backlog]);

  // ── 탭 6: 수익성 + 재방문 ──────────────────────────────────
  const profitabilityStats = useMemo(() => {
    const map = {};
    completedServices.forEach(s => {
      const type = s.reception_type || '미분류';
      if (!map[type]) map[type] = { type, revenue: 0, cost: 0, count: 0 };
      map[type].count++;
      (s.service_parts || []).forEach(sp => {
        const qty = getEffectiveQty(sp);
        map[type].revenue += (sp.price || 0) * qty;
        map[type].cost += (sp.parts?.cost_price || 0) * qty;
      });
    });
    return Object.values(map).map(r => ({
      ...r, profit: r.revenue - r.cost,
      margin: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.revenue - a.revenue);
  }, [completedServices]);

  const warrantyStats = useMemo(() => {
    const free = completedServices.filter(s =>
      getTags(s).some(t => t.includes('워런티'))
    ).length;
    const paid = completedServices.length - free;
    return { free, paid, total: completedServices.length };
  }, [completedServices]);

  const repeatCustomers = useMemo(() => {
    const map = {};
    services.forEach(s => {
      const name = s.customer_name || '미상';
      if (!map[name]) map[name] = { name, count: 0, brands: new Set(), lastDate: null };
      map[name].count++;
      if (s.brand) map[name].brands.add(s.brand);
      const d = s.reception_date;
      if (d && (!map[name].lastDate || d > map[name].lastDate)) map[name].lastDate = d;
    });
    return Object.values(map)
      .filter(c => c.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(c => ({ ...c, brands: Array.from(c.brands).join(', ') }));
  }, [services]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssessmentIcon /> A/S 통계
      </Typography>

      {/* 필터 */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <TextField select size="small" label="브랜드" value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)} sx={{ width: 130 }}>
          <MenuItem value="전체">전체</MenuItem>
          <MenuItem value="XRB">X-RIDER</MenuItem>
          <MenuItem value="NB">NEARBIKE</MenuItem>
        </TextField>
        <TextField size="small" label="시작일" type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
        <TextField size="small" label="종료일" type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[3, 6, 12].map(m => (
            <Chip key={m} label={m === 12 ? '1년' : `${m}개월`} onClick={() => setPeriod(m)}
              variant={filterStart === calcRange(m).start && filterEnd === calcRange(m).end ? 'filled' : 'outlined'}
              color="primary" sx={{ cursor: 'pointer' }} />
          ))}
        </Box>
      </Box>

      {/* 요약 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { icon: <BuildIcon />, label: '총 A/S 건수', value: `${fmt(services.length)}건`, sub: `완료 ${fmt(completedServices.length)}건` },
          { icon: <MoneyIcon />, label: '완료 A/S 금액', value: fmtWon(totalAmount), sub: `평균 ${completedServices.length > 0 ? fmtWon(totalAmount / completedServices.length) : '-'}/건` },
          { icon: <ScheduleIcon />, label: '평균 처리 시간', value: `${avgProcessingTime.toFixed(1)}일`, sub: `완료 ${fmt(completedServices.length)}건 기준` },
          { icon: <WarningIcon color="warning" />, label: '현재 미완료 백로그', value: `${fmt(backlog.length)}건`, sub: backlogWithDays[0] ? `최장 ${backlogWithDays[0].waitDays}일 대기` : '-' },
        ].map((card, i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {card.icon} {card.label}
                </Typography>
                <Typography variant="h5" fontWeight="bold">{card.value}</Typography>
                <Typography variant="caption" color="textSecondary">{card.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 탭 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="월별 추이" />
          <Tab label="태그 분석" />
          <Tab label="부품·모델 분석" />
          <Tab label="처리 시간·백로그" />
          <Tab label="수익성·재방문" />
          <Tab label="키워드 상관관계" />
        </Tabs>
      </Paper>

      {/* ── 탭 0: 월별 추이 ── */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>월별 A/S 건수 및 매출</Typography>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyStats} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${Math.round(v/10000)}만`} />
              <RechartsTooltip formatter={(v, name) => name === '금액' ? `${fmt(v)}원` : `${v}건`} />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="건수" fill="#1976d2" radius={[3,3,0,0]} />
              <Bar yAxisId="right" dataKey="amount" name="금액" fill="#2e7d32" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* ── 탭 1: 태그 분석 ── */}
      {tabValue === 1 && (
        <>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>태그별 발생 빈도 (상위 15개)</Typography>
          <Box sx={{ mb: 2 }}>
            {tagStats.map(t => (
              <Chip key={t.tag} label={`${t.tag} (${t.count})`} sx={{ m: 0.5 }} color="primary" variant="outlined" />
            ))}
          </Box>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={tagStats} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="tag" width={80} tick={{ fontSize: 12 }} />
              <RechartsTooltip formatter={v => [`${v}건`]} />
              <Bar dataKey="count" name="건수" fill="#9c27b0" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>

        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>태그별 주요 교체 부품</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>태그가 붙은 A/S에서 실제 사용된 부품 상위 5개</Typography>
          {tagPartCorrelation.length === 0 ? (
            <Typography color="textSecondary">데이터 없음</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 120 }}>태그</TableCell>
                    <TableCell align="right" sx={{ width: 60 }}>건수</TableCell>
                    <TableCell>주요 교체 부품 (건수)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tagPartCorrelation.map(r => (
                    <TableRow key={r.tag}>
                      <TableCell>
                        <Chip size="small" label={r.tag} color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell align="right">{r.total}</TableCell>
                      <TableCell>
                        {r.topParts.length === 0
                          ? <Typography variant="caption" color="text.secondary">부품 없음</Typography>
                          : r.topParts.map(([name, cnt]) => (
                            <Chip key={name} size="small" label={`${name} (${cnt})`}
                              sx={{ m: 0.3, fontSize: 11 }} variant="outlined" />
                          ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
        </>
      )}

      {/* ── 탭 3: 부품 소모 순위 + 모델별 패턴 ── */}
      {tabValue === 2 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>부품 소모 순위 (완료 건 기준)</Typography>
              {partsStats.length === 0 ? (
                <Typography color="textSecondary">데이터 없음</Typography>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={partsStats.slice(0, 10)} layout="vertical" margin={{ left: 120, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <RechartsTooltip formatter={(v, name) => name === '교체 수량' ? `${v}개` : `${fmt(v)}원`} />
                      <Legend />
                      <Bar dataKey="count" name="교체 수량" fill="#1976d2" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>부품명</TableCell>
                          <TableCell align="right">수량</TableCell>
                          <TableCell align="right">매출</TableCell>
                          <TableCell align="right">원가</TableCell>
                          <TableCell align="right">이익</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {partsStats.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell sx={{ fontSize: 12 }}>{p.name}</TableCell>
                            <TableCell align="right">{p.count}개</TableCell>
                            <TableCell align="right">{fmt(p.revenue)}원</TableCell>
                            <TableCell align="right" sx={{ color: 'text.secondary', fontSize: 11 }}>{fmt(p.cost)}원</TableCell>
                            <TableCell align="right" sx={{ color: p.revenue - p.cost >= 0 ? 'success.main' : 'error.main' }}>
                              {fmt(p.revenue - p.cost)}원
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>브랜드별 주요 고장 패턴</Typography>
              {modelStats.map(m => (
                <Box key={m.brand} sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography fontWeight="bold">{m.brand || '미분류'}</Typography>
                    <Chip size="small" label={`${m.count}건`} />
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    {m.topTags.map(([tag, cnt]) => (
                      <Chip key={tag} size="small" label={`${tag} ${cnt}`} variant="outlined" color="primary" />
                    ))}
                    {m.topTags.length === 0 && <Typography variant="caption" color="textSecondary">태그 없음</Typography>}
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    유형: {m.topTypes.map(([t, c]) => `${t}(${c})`).join(' · ')}
                  </Typography>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── 탭 3: 처리 시간 분포 + 백로그 ── */}
      {tabValue === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={9}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>처리 시간 분포</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={processingTimeStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <RechartsTooltip formatter={v => [`${v}건`]} />
                  <Bar dataKey="count" name="건수" fill="#ed6c02" radius={[3,3,0,0]}>
                    {processingTimeStats.map((entry, i) => (
                      <Cell key={i} fill={entry.min >= 15 ? '#d32f2f' : entry.min >= 8 ? '#ed6c02' : '#2e7d32'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableBody>
                    {processingTimeStats.map(b => (
                      <TableRow key={b.label}>
                        <TableCell>{b.label}</TableCell>
                        <TableCell align="right">{b.count}건</TableCell>
                        <TableCell align="right">{b.pct}%</TableCell>
                        <TableCell sx={{ width: 160 }}>
                          <LinearProgress variant="determinate" value={parseFloat(b.pct)}
                            color={b.min >= 15 ? 'error' : b.min >= 8 ? 'warning' : 'success'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>미완료 백로그</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography variant="h4" fontWeight="bold" color="warning.main">{backlog.length}</Typography>
                <Typography variant="body2" color="text.secondary">건</Typography>
              </Box>
              {backlogWithDays[0] && (
                <Typography variant="caption" color="error.main">
                  최장 {backlogWithDays[0].waitDays}일 대기
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── 탭 5: 수익성 + 재방문 ── */}
      {tabValue === 4 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>유형별 수익성 분석</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={[
                      { name: '일반 유상', value: warrantyStats.paid },
                      { name: '워런티', value: warrantyStats.free },
                    ]} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                      <Cell fill="#1976d2" />
                      <Cell fill="#2e7d32" />
                    </Pie>
                    <RechartsTooltip formatter={(v, n) => [`${v}건`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1976d2' }} />
                    <Typography variant="body2">일반 유상 <b>{warrantyStats.paid}건</b></Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#2e7d32' }} />
                    <Typography variant="body2">워런티 <b>{warrantyStats.free}건</b></Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    워런티 비율 {warrantyStats.total > 0 ? (warrantyStats.free / warrantyStats.total * 100).toFixed(1) : 0}%
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>유형</TableCell>
                      <TableCell align="right">건수</TableCell>
                      <TableCell align="right">매출</TableCell>
                      <TableCell align="right">원가</TableCell>
                      <TableCell align="right">이익</TableCell>
                      <TableCell align="right">마진율</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {profitabilityStats.map(r => (
                      <TableRow key={r.type}>
                        <TableCell>{r.type || '미분류'}</TableCell>
                        <TableCell align="right">{r.count}건</TableCell>
                        <TableCell align="right">{fmt(r.revenue)}원</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontSize: 11 }}>{fmt(r.cost)}원</TableCell>
                        <TableCell align="right" sx={{ color: r.profit >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                          {fmt(r.profit)}원
                        </TableCell>
                        <TableCell align="right">{r.margin}%</TableCell>
                      </TableRow>
                    ))}
                    {profitabilityStats.length > 0 && (
                      <TableRow sx={{ bgcolor: 'grey.50', fontWeight: 'bold' }}>
                        <TableCell><b>합계</b></TableCell>
                        <TableCell align="right"><b>{profitabilityStats.reduce((s, r) => s + r.count, 0)}건</b></TableCell>
                        <TableCell align="right"><b>{fmt(profitabilityStats.reduce((s, r) => s + r.revenue, 0))}원</b></TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontSize: 11 }}>
                          {fmt(profitabilityStats.reduce((s, r) => s + r.cost, 0))}원
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                          {fmt(profitabilityStats.reduce((s, r) => s + r.profit, 0))}원
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon /> 재방문 고객 (2회 이상)
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
                총 {repeatCustomers.length}명 · 전체 {services.length}건 중 재방문 {repeatCustomers.reduce((s, c) => s + c.count, 0)}건
              </Typography>
              {repeatCustomers.length === 0 ? (
                <Typography color="textSecondary">해당 없음</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 420 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>고객명</TableCell>
                        <TableCell align="right">방문</TableCell>
                        <TableCell>브랜드</TableCell>
                        <TableCell>최근 접수</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {repeatCustomers.map(c => (
                        <TableRow key={c.name}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell align="right">
                            <Chip size="small" label={`${c.count}회`} color={c.count >= 4 ? 'error' : c.count >= 3 ? 'warning' : 'primary'} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 11 }}>{c.brands}</TableCell>
                          <TableCell sx={{ fontSize: 11 }}>
                            {c.lastDate ? format(parseISO(c.lastDate), 'yy.MM.dd') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
      {/* ── 탭 5: 키워드 상관관계 ── */}
      {tabValue === 5 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">증상 키워드 ↔ 처리내역 상관관계</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {correlationLoading && <CircularProgress size={18} />}
              <Chip
                label="AI 패턴 분석"
                clickable
                color="primary"
                variant="outlined"
                disabled={correlationLoading || keywordCorrelationData.length === 0}
                onClick={async () => {
                  setCorrelationLoading(true);
                  setCorrelationInsight('');
                  try {
                    const result = await generateCorrelationInsights(keywordCorrelationData);
                    setCorrelationInsight(result);
                  } catch (e) {
                    setCorrelationInsight(`분석 오류: ${e.message}`);
                  } finally {
                    setCorrelationLoading(false);
                  }
                }}
              />
            </Box>
          </Box>

          {keywordCorrelationData.length === 0 ? (
            <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
              완료된 A/S에 문의내용·처리내역이 입력된 건이 없습니다.
            </Typography>
          ) : (
            <>
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 600 }}>증상 키워드</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>건수</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>주요 처리내역 (빈도순)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {keywordCorrelationData.map((row) => (
                      <TableRow key={row.keyword} hover>
                        <TableCell>
                          <Chip label={row.keyword} size="small" sx={{ bgcolor: '#e3f2fd', color: '#1565c0' }} />
                        </TableCell>
                        <TableCell align="right">{row.count}건</TableCell>
                        <TableCell>
                          {row.topSolutions.map((s, i) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                              <Typography variant="caption" sx={{ color: '#888', minWidth: 16 }}>{i + 1}.</Typography>
                              <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>
                                {s.solution}
                              </Typography>
                              <Chip label={`${s.count}건`} size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                            </Box>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {correlationInsight && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  {correlationInsight}
                </Paper>
              )}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default ServiceStats;
