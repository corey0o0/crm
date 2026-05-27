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
        .select('id, reception_date, completion_date, created_at, customer_name, brand, status, reception_type, service_tags(tag_name), service_parts(price, quantity, usage, parts(name, code, cost_price))')
        .gte('reception_date', filterStart)
        .lte('reception_date', filterEnd);

      let backlogQuery = supabase
        .from('services')
        .select('id, reception_date, customer_name, brand, status, reception_type, service_tags(tag_name)')
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

  // ── 탭 2: 상태별 ───────────────────────────────────────────
  const statusStats = useMemo(() => {
    const counts = {};
    services.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count, pct: (count / services.length * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
  }, [services]);

  // ── 탭 3: 유형 / 태그 ──────────────────────────────────────
  const typeStats = useMemo(() => {
    const counts = {};
    services.forEach(s => { counts[s.reception_type || '미분류'] = (counts[s.reception_type || '미분류'] || 0) + 1; });
    return Object.entries(counts)
      .map(([type, count]) => ({ type, count, pct: (count / services.length * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
  }, [services]);

  const tagStats = useMemo(() => {
    const counts = {};
    services.forEach(s => getTags(s).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count, pct: (count / services.length * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count).slice(0, 15);
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
          <Tab label="상태·유형" />
          <Tab label="태그 분석" />
          <Tab label="부품·모델 분석" />
          <Tab label="처리 시간·백로그" />
          <Tab label="수익성·재방문" />
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

      {/* ── 탭 1: 상태·유형 ── */}
      {tabValue === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>상태별 현황</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusStats} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90}
                    label={({ status, pct }) => `${status} ${pct}%`}>
                    {statusStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v, n) => [`${v}건`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableBody>
                    {statusStats.map(s => (
                      <TableRow key={s.status}>
                        <TableCell>{s.status}</TableCell>
                        <TableCell align="right">{s.count}건</TableCell>
                        <TableCell align="right">{s.pct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>유형별 현황</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={typeStats} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={90}
                    label={({ type, pct }) => `${type} ${pct}%`}>
                    {typeStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableBody>
                    {typeStats.map(s => (
                      <TableRow key={s.type}>
                        <TableCell>{s.type || '미분류'}</TableCell>
                        <TableCell align="right">{s.count}건</TableCell>
                        <TableCell align="right">{s.pct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── 탭 2: 태그 분석 ── */}
      {tabValue === 2 && (
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
      )}

      {/* ── 탭 3: 부품 소모 순위 + 모델별 패턴 ── */}
      {tabValue === 3 && (
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

      {/* ── 탭 4: 처리 시간 분포 + 백로그 ── */}
      {tabValue === 4 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>처리 시간 분포</Typography>
              <ResponsiveContainer width="100%" height={240}>
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
                        <TableCell sx={{ width: 100 }}>
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
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                현재 미완료 백로그 ({backlog.length}건)
              </Typography>
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>고객명</TableCell>
                      <TableCell>브랜드</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>유형</TableCell>
                      <TableCell align="right">대기일</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {backlogWithDays.map(s => (
                      <TableRow key={s.id}
                        sx={{ bgcolor: s.waitDays >= 14 ? 'error.50' : s.waitDays >= 7 ? 'warning.50' : 'inherit' }}>
                        <TableCell>{s.customer_name || '-'}</TableCell>
                        <TableCell>{s.brand || '-'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={s.status || '-'}
                            color={s.status === '부품대기' ? 'warning' : 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{s.reception_type || '-'}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold"
                            color={s.waitDays >= 14 ? 'error.main' : s.waitDays >= 7 ? 'warning.main' : 'inherit'}>
                            {s.waitDays ?? '-'}일
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── 탭 5: 수익성 + 재방문 ── */}
      {tabValue === 5 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>유형별 수익성 분석</Typography>
              <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="textSecondary">유상 처리</Typography>
                  <Typography variant="h6" color="primary.main">{warrantyStats.paid}건</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">무상 처리</Typography>
                  <Typography variant="h6" color="text.secondary">{warrantyStats.free}건</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">무상 비율</Typography>
                  <Typography variant="h6">
                    {warrantyStats.total > 0 ? (warrantyStats.free / warrantyStats.total * 100).toFixed(1) : 0}%
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
    </Box>
  );
}

export default ServiceStats;
