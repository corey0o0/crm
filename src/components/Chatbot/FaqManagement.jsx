import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Switch, FormControlLabel, Snackbar, Alert, CircularProgress,
  Tooltip, Divider, Card, CardContent, Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  AutoFixHigh as AutoFixHighIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import InputAdornment from '@mui/material/InputAdornment';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import ChatbotSettings from './ChatbotSettings';

const BRANDS = ['ALL', 'SHARED', 'NB', 'XRB'];
const REPLY_TYPES = ['all', 'faq', 'faq_llm', 'llm'];

const EMPTY_FORM = {
  brand: 'SHARED',
  label: '',
  keywords: '',
  answer: '',
  category: '',
  is_active: true,
  sort_order: 0,
  is_announcement: false,
  start_date: '',
  end_date: '',
};

export default function FaqManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [faqs, setFaqs] = useState([]);
  const [chatLogs, setChatLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [logBrandFilter, setLogBrandFilter] = useState('all');
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [editDialog, setEditDialog] = useState({ open: false, item: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [enhanceBrand, setEnhanceBrand] = useState('nb');
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showMsg = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  // ── FAQ 불러오기 ──
  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    const query = supabase.from('faq_items').select('*')
      .order('is_announcement', { ascending: false })
      .order('sort_order')
      .order('created_at');
    if (brandFilter !== 'ALL') query.eq('brand', brandFilter);
    const { data, error } = await query;
    setLoading(false);
    if (error) { showMsg('FAQ 불러오기 실패', 'error'); return; }
    setFaqs(data || []);
  }, [brandFilter]);

  // ── 채팅 로그 불러오기 ──
  const fetchChatLogs = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('chat_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (logBrandFilter !== 'all') query.eq('brand', logBrandFilter);
    if (logTypeFilter !== 'all') query.eq('reply_type', logTypeFilter);
    const { data, error } = await query;
    setLoading(false);
    if (error) { showMsg('채팅 로그 불러오기 실패', 'error'); return; }
    setChatLogs(data || []);
  }, [logBrandFilter, logTypeFilter]);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);
  useEffect(() => { if (tabValue === 1) fetchChatLogs(); }, [tabValue, fetchChatLogs]);

  // ── 저장 ──
  const handleSave = async () => {
    if (!form.label.trim() || !form.answer.trim()) {
      showMsg('카테고리명과 답변은 필수입니다.', 'warning'); return;
    }
    const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
    const payload = {
      ...form,
      keywords,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      updated_at: new Date().toISOString(),
    };
    delete payload.keywords_str;

    let error;
    if (editDialog.item) {
      ({ error } = await supabase.from('faq_items').update(payload).eq('id', editDialog.item.id));
    } else {
      delete payload.id;
      ({ error } = await supabase.from('faq_items').insert(payload));
    }
    if (error) { showMsg('저장 실패: ' + error.message, 'error'); return; }
    showMsg(editDialog.item ? 'FAQ가 수정되었습니다.' : 'FAQ가 추가되었습니다.');
    setEditDialog({ open: false, item: null });
    fetchFaqs();
  };

  // ── 삭제 ──
  const handleDelete = async () => {
    const { error } = await supabase.from('faq_items').delete().eq('id', deleteDialog.id);
    if (error) { showMsg('삭제 실패', 'error'); return; }
    showMsg('삭제되었습니다.');
    setDeleteDialog({ open: false, id: null });
    fetchFaqs();
  };

  // ── 활성/비활성 토글 ──
  const toggleActive = async (item) => {
    const { error } = await supabase
      .from('faq_items').update({ is_active: !item.is_active }).eq('id', item.id);
    if (error) { showMsg('변경 실패', 'error'); return; }
    setFaqs(prev => prev.map(f => f.id === item.id ? { ...f, is_active: !f.is_active } : f));
  };

  // ── 편집 다이얼로그 열기 ──
  const openEdit = (item = null) => {
    setForm(item
      ? { ...item, keywords: (item.keywords || []).join(', '), start_date: item.start_date || '', end_date: item.end_date || '' }
      : EMPTY_FORM
    );
    setEditDialog({ open: true, item });
  };

  // ── AI 제안 실행 ──
  const runEnhance = async () => {
    setEnhanceLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch('/.netlify/functions/chatbot-faq-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: enhanceBrand }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 오류');
      setSuggestions(data.suggestions || []);
      if (data.suggestions?.length === 0) showMsg(data.message || '새로운 제안이 없습니다.', 'info');
      else showMsg(`${data.suggestions.length}개 제안이 생성되었습니다.`, 'info');
    } catch (e) {
      showMsg('AI 분석 실패: ' + e.message, 'error');
    } finally {
      setEnhanceLoading(false);
    }
  };

  // ── AI 제안 승인 ──
  const approveSuggestion = async (s) => {
    const brandVal = enhanceBrand === 'nb' ? 'NB' : 'XRB';
    const { error } = await supabase.from('faq_items').insert({
      brand: brandVal,
      label: s.label,
      keywords: s.keywords,
      answer: s.answer,
      source: 'ai_suggested',
      is_active: true,
    });
    if (error) { showMsg('추가 실패', 'error'); return; }
    showMsg(`'${s.label}' FAQ가 추가되었습니다.`);
    setSuggestions(prev => prev.filter(x => x.label !== s.label));
    if (tabValue === 0) fetchFaqs();
  };

  const categories = ['ALL', ...Array.from(new Set(faqs.map(f => f.category).filter(Boolean))).sort()];

  const filteredFaqs = faqs.filter(faq => {
    if (activeFilter === 'active' && !faq.is_active) return false;
    if (activeFilter === 'inactive' && faq.is_active) return false;
    if (categoryFilter !== 'ALL' && faq.category !== categoryFilter) return false;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const inLabel = faq.label?.toLowerCase().includes(q);
      const inAnswer = faq.answer?.toLowerCase().includes(q);
      const inKeywords = (faq.keywords || []).some(k => k.toLowerCase().includes(q));
      if (!inLabel && !inAnswer && !inKeywords) return false;
    }
    return true;
  });

  const filteredLogs = chatLogs.filter(log => {
    if (!logSearch.trim()) return true;
    const q = logSearch.trim().toLowerCase();
    return log.user_message?.toLowerCase().includes(q) ||
      log.matched_faq_label?.toLowerCase().includes(q) ||
      log.bot_reply?.toLowerCase().includes(q);
  });

  const brandColor = { SHARED: 'default', NB: 'primary', XRB: 'error' };
  const replyTypeColor = { faq: 'success', faq_llm: 'warning', llm: 'info', error: 'error' };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>챗봇 FAQ 관리</Typography>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="FAQ 목록" />
        <Tab label="채팅 로그" />
        <Tab label="AI 제안" />
        <Tab label="운영 설정" />
      </Tabs>

      {/* ── Tab 3: 운영 설정 (ON/OFF·시간) ── */}
      {tabValue === 3 && <ChatbotSettings />}

      {/* ── Tab 0: FAQ 목록 ── */}
      {tabValue === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="레이블·키워드·답변 검색"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: searchText ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchText('')}><ClearIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>브랜드</InputLabel>
              <Select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} label="브랜드">
                {BRANDS.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>카테고리</InputLabel>
              <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} label="카테고리">
                {categories.map(c => <MenuItem key={c} value={c}>{c === 'ALL' ? '전체' : c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>활성</InputLabel>
              <Select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} label="활성">
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="active">활성만</MenuItem>
                <MenuItem value="inactive">비활성만</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              {filteredFaqs.length}/{faqs.length}건
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<RefreshIcon />} onClick={fetchFaqs} disabled={loading}>새로고침</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEdit()}>FAQ 추가</Button>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell width={80}>브랜드</TableCell>
                    <TableCell width={120}>카테고리</TableCell>
                    <TableCell>키워드</TableCell>
                    <TableCell>답변 미리보기</TableCell>
                    <TableCell width={60} align="center">사용</TableCell>
                    <TableCell width={70} align="center">활성</TableCell>
                    <TableCell width={90} align="center">작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredFaqs.length === 0 && (
                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {faqs.length === 0 ? 'FAQ가 없습니다. 추가해주세요.' : '검색 결과가 없습니다.'}
                    </TableCell></TableRow>
                  )}
                  {filteredFaqs.map(faq => (
                    <TableRow key={faq.id} sx={{ opacity: faq.is_active ? 1 : 0.45 }}>
                      <TableCell><Chip label={faq.brand} size="small" color={brandColor[faq.brand] || 'default'} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {faq.is_announcement && (
                            <Chip icon={<CampaignIcon fontSize="small" />} label="공지" size="small" color="warning" />
                          )}
                          <Typography variant="body2" fontWeight="bold">{faq.label}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 250 }}>
                          {(faq.keywords || []).slice(0, 4).map(kw => (
                            <Chip key={kw} label={kw} size="small" variant="outlined" />
                          ))}
                          {(faq.keywords || []).length > 4 && (
                            <Chip label={`+${faq.keywords.length - 4}`} size="small" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {faq.answer}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">{faq.usage_count}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Switch size="small" checked={faq.is_active} onChange={() => toggleActive(faq)} />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="편집">
                          <IconButton size="small" onClick={() => openEdit(faq)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="삭제">
                          <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: faq.id })}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ── Tab 1: 채팅 로그 ── */}
      {tabValue === 1 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="메시지·FAQ명 검색"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              sx={{ minWidth: 180 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: logSearch ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setLogSearch('')}><ClearIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>브랜드</InputLabel>
              <Select value={logBrandFilter} onChange={e => setLogBrandFilter(e.target.value)} label="브랜드">
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="nb">NB</MenuItem>
                <MenuItem value="xrb">XRB</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>응답 유형</InputLabel>
              <Select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)} label="응답 유형">
                {REPLY_TYPES.map(t => <MenuItem key={t} value={t}>{t === 'all' ? '전체' : t}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              {filteredLogs.length}/{chatLogs.length}건
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<RefreshIcon />} onClick={fetchChatLogs} disabled={loading}>새로고침</Button>
          </Box>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell width={140}>시간</TableCell>
                    <TableCell width={60}>브랜드</TableCell>
                    <TableCell>고객 메시지</TableCell>
                    <TableCell>봇 응답 미리보기</TableCell>
                    <TableCell width={100}>유형</TableCell>
                    <TableCell width={100}>매칭 FAQ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {chatLogs.length === 0 ? '채팅 로그가 없습니다.' : '검색 결과가 없습니다.'}
                    </TableCell></TableRow>
                  )}
                  {filteredLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {format(new Date(log.created_at), 'MM/dd HH:mm')}
                      </TableCell>
                      <TableCell><Chip label={log.brand?.toUpperCase()} size="small" /></TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.user_message}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          {log.bot_reply || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={log.reply_type} size="small" color={replyTypeColor[log.reply_type] || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{log.matched_faq_label || '-'}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ── Tab 2: AI 제안 ── */}
      {tabValue === 2 && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>AI FAQ 자동 제안</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                최근 30일 동안 FAQ로 답변되지 않고 LLM으로 처리된 질문들을 분석하여 새로운 FAQ 항목을 제안합니다.
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>브랜드</InputLabel>
                  <Select value={enhanceBrand} onChange={e => setEnhanceBrand(e.target.value)} label="브랜드">
                    <MenuItem value="nb">NB (니어바이크)</MenuItem>
                    <MenuItem value="xrb">XRB (X-RIDER)</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={enhanceLoading ? <CircularProgress size={18} color="inherit" /> : <AutoFixHighIcon />}
                  onClick={runEnhance}
                  disabled={enhanceLoading}
                >
                  {enhanceLoading ? '분석 중...' : 'AI 분석 실행'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {suggestions.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                제안된 FAQ ({suggestions.length}개) — 승인하면 즉시 FAQ 목록에 추가됩니다
              </Typography>
              <Stack spacing={2}>
                {suggestions.map((s, i) => (
                  <Paper key={i} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">{s.label}</Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => approveSuggestion(s)}
                        >승인</Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<CancelIcon />}
                          onClick={() => setSuggestions(prev => prev.filter((_, j) => j !== i))}
                        >거절</Button>
                      </Stack>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {(s.keywords || []).map(kw => <Chip key={kw} label={kw} size="small" variant="outlined" />)}
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-line' }}>{s.answer}</Typography>
                    {s.reason && (
                      <Typography variant="caption" color="text.secondary">💡 {s.reason}</Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}

      {/* ── 편집 다이얼로그 ── */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, item: null })} maxWidth="md" fullWidth>
        <DialogTitle>{editDialog.item ? 'FAQ 편집' : 'FAQ 추가'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>브랜드</InputLabel>
                <Select value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} label="브랜드">
                  <MenuItem value="SHARED">SHARED (공통)</MenuItem>
                  <MenuItem value="NB">NB</MenuItem>
                  <MenuItem value="XRB">XRB</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="카테고리명 (label)"
                size="small"
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                sx={{ flex: 1 }}
                placeholder="예: 배터리충전"
              />
              <TextField
                label="정렬순서"
                size="small"
                type="number"
                value={form.sort_order}
                onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                sx={{ width: 100 }}
              />
            </Stack>
            <TextField
              label="키워드 (쉼표로 구분)"
              size="small"
              fullWidth
              value={form.keywords}
              onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))}
              placeholder="배터리, 충전, 완충, 충전안됨"
              helperText="쉼표(,)로 구분하여 입력"
            />
            <TextField
              label="답변 내용"
              multiline
              rows={6}
              fullWidth
              value={form.answer}
              onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
              placeholder="고객에게 표시될 답변 내용"
            />
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="카테고리"
                size="small"
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                placeholder="배터리, 배송, A/S 등"
                sx={{ flex: 1 }}
              />
              <FormControlLabel
                control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                label="활성화"
              />
              <FormControlLabel
                control={<Switch checked={form.is_announcement} onChange={e => setForm(p => ({ ...p, is_announcement: e.target.checked }))} />}
                label="공지사항"
              />
            </Stack>
            {form.is_announcement && (
              <Stack direction="row" spacing={2}>
                <TextField
                  label="시작일"
                  size="small"
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  helperText="비워두면 즉시 시작"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="종료일"
                  size="small"
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  helperText="비워두면 무기한"
                  sx={{ flex: 1 }}
                />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, item: null })}>취소</Button>
          <Button variant="contained" onClick={handleSave}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* ── 삭제 확인 다이얼로그 ── */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null })}>
        <DialogTitle>FAQ 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 FAQ 항목을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
