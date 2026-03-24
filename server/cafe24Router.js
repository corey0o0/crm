const axios = require('axios');

module.exports = function(supabaseAdmin) {
  const router = require('express').Router();

  // 1. 몰 관리 API
  router.get('/malls', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('cafe24_settings').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      
      const malls = data.map(m => {
        const tokenExpired = m.token_expires_at ? new Date(m.token_expires_at) < new Date() : true;
        return {
          mall_id: m.mall_id,
          client_id: m.client_id,
          connected: !!m.access_token && !tokenExpired,
          board_no: m.board_no,
          last_synced_at: m.last_synced_at,
          token_expired: tokenExpired
        };
      });
      res.json({ success: true, malls });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/malls', async (req, res) => {
    try {
      const { mall_id, client_id, client_secret } = req.body;
      if (!mall_id || !client_id || !client_secret) return res.status(400).json({ error: 'Missing fields' });
      
      const { error } = await supabaseAdmin.from('cafe24_settings').upsert({
        mall_id, client_id, client_secret_encrypted: client_secret
      }, { onConflict: 'mall_id' });
      if (error) throw error;
      res.json({ success: true, message: '쇼핑몰이 등록되었습니다.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/malls/:mall_id', async (req, res) => {
    try {
      const { error } = await supabaseAdmin.from('cafe24_settings').delete().eq('mall_id', req.params.mall_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
  router.post('/malls/:mall_id/board', async (req, res) => {
    try {
      const { board_no } = req.body;
      const { error } = await supabaseAdmin.from('cafe24_settings').update({ board_no }).eq('mall_id', req.params.mall_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. OAuth 토큰 갱신 헬퍼
  async function refreshCafe24Token(mall) {
    const credentials = Buffer.from(`${mall.client_id}:${mall.client_secret_encrypted}`).toString('base64');
    const resp = await axios.post(
      `https://${mall.mall_id}.cafe24api.com/api/v2/oauth/token`,
      `grant_type=refresh_token&refresh_token=${mall.refresh_token}`,
      { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const expiresAt = new Date(resp.data.expires_at).toISOString();
    
    await supabaseAdmin.from('cafe24_settings').update({
      access_token: resp.data.access_token,
      refresh_token: resp.data.refresh_token,
      token_expires_at: expiresAt
    }).eq('mall_id', mall.mall_id);
    
    return resp.data.access_token;
  }

  async function getValidToken(mall_id) {
    const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', mall_id).single();
    if (!mall || !mall.access_token) throw new Error(`${mall_id}: 카페24 인증이 필요합니다.`);
    
    const now = new Date();
    const expiresAt = mall.token_expires_at ? new Date(mall.token_expires_at) : now;
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      return await refreshCafe24Token(mall);
    }
    return mall.access_token;
  }

  router.get('/config/:mall_id', async (req, res) => {
    try {
      const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('mall_id, client_id').eq('mall_id', req.params.mall_id).single();
      if (!mall) return res.status(404).json({ error: '쇼핑몰 정보를 찾을 수 없습니다.' });
      res.json(mall);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/auth/callback', async (req, res) => {
    try {
      const { code, redirect_uri, mall_id } = req.body;
      if (!code || !mall_id) return res.status(400).json({ error: '필수 파라미터 누락' });
      
      const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', mall_id).single();
      if (!mall) return res.status(404).json({ error: 'DB 속 쇼핑몰 정보가 없습니다.' });

      const credentials = Buffer.from(`${mall.client_id}:${mall.client_secret_encrypted}`).toString('base64');
      const resp = await axios.post(
        `https://${mall_id}.cafe24api.com/api/v2/oauth/token`,
        `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const expiresAt = new Date(resp.data.expires_at).toISOString();
      await supabaseAdmin.from('cafe24_settings').update({
        access_token: resp.data.access_token,
        refresh_token: resp.data.refresh_token,
        token_expires_at: expiresAt
      }).eq('mall_id', mall_id);

      res.json({ success: true, message: '연동 성공' });
    } catch (error) {
      const cafe24Err = error?.response?.data?.error_description || error.message;
      res.status(500).json({ error: `카페24 인증 실패: ${cafe24Err}` });
    }
  });

  router.get('/products', async (req, res) => {
    try {
      const { data: malls } = await supabaseAdmin.from('cafe24_settings').select('mall_id').not('access_token', 'is', null);
      if (!malls || malls.length === 0) return res.json({ success: true, products: [] });

      let allProducts = [];
      await Promise.all(malls.map(async m => {
        try {
          const token = await getValidToken(m.mall_id);
          const resp = await axios.get(`https://${m.mall_id}.cafe24api.com/api/v2/admin/products?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
          });
          const pds = (resp.data.products || []).map(p => {
             // 보존하기 위해 _mall_id만 주입
             return { ...p, _mall_id: m.mall_id };
          });
          allProducts = allProducts.concat(pds);
        } catch(e) { console.error(`[Cafe24] ${m.mall_id} 상품 조회 실패`, e.message); }
      }));
      res.json({ success: true, products: allProducts });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post('/sync/:mall_id', async (req, res) => {
    try {
      const { mall_id } = req.params;
      const { board_no } = req.body;
      const boardNos = typeof board_no === 'string' ? board_no.split(',').map(n => n.trim()) : [board_no];
      
      const token = await getValidToken(mall_id);
      let totalInserted = 0, totalSkipped = 0;

      for (const bNo of boardNos) {
        if (!bNo) continue;
        const resp = await axios.get(`https://${mall_id}.cafe24api.com/api/v2/admin/boards/${bNo}/articles?limit=50`, {
           headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
        });
        
        for (const article of resp.data.articles || []) {
          const payload = {
            title: article.title,
            content: article.content || article.content_text || '',
            author_email: article.writer?.email || null,
            source: 'cafe24',
            cafe24_article_no: article.article_no,
            cafe24_board_no: bNo,
            cafe24_writer_name: article.writer?.name || null,
            cafe24_writer_email: article.writer?.email || null,
            cafe24_url: `https://${mall_id}.cafe24.com/board/${bNo}/article/${article.article_no}`,
            cafe24_mall_id: mall_id,
            synced_at: new Date().toISOString(),
            created_at: article.created_date || new Date().toISOString()
          };

          const { data: existing } = await supabaseAdmin.from('board_posts').select('id')
            .eq('cafe24_mall_id', mall_id)
            .eq('cafe24_board_no', bNo)
            .eq('cafe24_article_no', article.article_no)
            .maybeSingle();

          let err = null;
          if (existing) err = (await supabaseAdmin.from('board_posts').update(payload).eq('id', existing.id)).error;
          else err = (await supabaseAdmin.from('board_posts').insert(payload)).error;
          
          if (err) totalSkipped++; else totalInserted++;
        }
      }
      
      await supabaseAdmin.from('cafe24_settings').update({ last_synced_at: new Date().toISOString() }).eq('mall_id', mall_id);

      res.json({ success: true, message: `동기화 완료: ${totalInserted}개 저장, ${totalSkipped}개 오류` });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/boards/:mall_id', async (req, res) => {
    try {
      const token = await getValidToken(req.params.mall_id);
      const resp = await axios.get(`https://${req.params.mall_id}.cafe24api.com/api/v2/admin/boards`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
      });
      res.json({ boards: resp.data.boards || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/boards/:mall_id/:board_no/articles/:article_no/comments', async (req, res) => {
    try {
      const { mall_id, board_no, article_no } = req.params;
      const { content } = req.body;
      const token = await getValidToken(mall_id);
      await axios.post(`https://${mall_id}.cafe24api.com/api/v2/admin/boards/${board_no}/articles/${article_no}/comments`, {
        shop_no: 1, content
      }, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
