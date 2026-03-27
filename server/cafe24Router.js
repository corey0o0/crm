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
    try {
      const resp = await axios.post(
        `https://${mall.mall_id}.cafe24api.com/api/v2/oauth/token`,
        `grant_type=refresh_token&refresh_token=${mall.refresh_token}`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      
      let expiresAt;
      if (resp.data.expires_at) {
        // Cafe24 returns expires_at like "YYYY-MM-DDTHH:mm:ss.000" (implicitly KST)
        // Ensure we parse it correctly or fallback to now + 2 hours
        expiresAt = new Date(resp.data.expires_at).toISOString();
      } else {
        expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      }
      
      await supabaseAdmin.from('cafe24_settings').update({
        access_token: resp.data.access_token,
        refresh_token: resp.data.refresh_token,
        token_expires_at: expiresAt
      }).eq('mall_id', mall.mall_id);
      
      return resp.data.access_token;
    } catch (e) {
      console.error('[Cafe24 Refresh Token Error]', e.response?.data || e.message);
      // If refresh token is expired or invalid, we should clear the token or prompt re-auth
      if (e.response && (e.response.status === 400 || e.response.status === 401)) {
        await supabaseAdmin.from('cafe24_settings').update({
          access_token: null,
          token_expires_at: null
        }).eq('mall_id', mall.mall_id);
        throw new Error(`${mall.mall_id}: 카페24 자동 로그인(리프레시 토큰)이 만료되었습니다. 몰 설정에서 다시 연동해주세요.`);
      }
      throw e;
    }
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

  // 3-2. 주문 동기화 API
  router.post('/sync/orders/:mall_id', async (req, res) => {
    try {
      const { mall_id } = req.params;
      const { start_date, end_date } = req.body; // e.g. '2023-01-01', '2023-01-31'
      
      let token = await getValidToken(mall_id);
      let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;

      // 파라미터가 없으면 최근 7일 기준으로 설정
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const queryStart = start_date || lastWeek.toISOString().split('T')[0];
      const queryEnd = end_date || today.toISOString().split('T')[0];

      // Fetch all barcodes and part_ids from parts table once for quick lookup
      const { data: partsList } = await supabaseAdmin.from('parts').select('id, barcode').not('barcode', 'is', null);
      const barcodeToPartIdMap = {};
      (partsList || []).forEach(p => {
        if(p.barcode) barcodeToPartIdMap[String(p.barcode).trim()] = p.id;
      });

      // Fetch manual product mappings
      const { data: manualMappings } = await supabaseAdmin.from('cafe24_product_to_part').select('cafe24_product_code, part_id').eq('mall_id', mall_id);
      const manualCodeToPartIdMap = {};
      (manualMappings || []).forEach(m => {
        manualCodeToPartIdMap[String(m.cafe24_product_code).trim()] = m.part_id;
      });

      // 카페24 API에서 주문 목록 가져오기 함수
      const fetchOrders = async (accessToken) => {
        return await axios.get(`https://${mall_id}.cafe24api.com/api/v2/admin/orders`, {
          params: { start_date: queryStart, end_date: queryEnd, date_type: 'order_date', limit: 100 },
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
        });
      };

      let response;
      try {
        response = await fetchOrders(token);
      } catch (e) {
        if (e.response && e.response.status === 401) {
          console.log('[Cafe24 API] 401 Unauthorized - Forcing token refresh...');
          const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', mall_id).single();
          token = await refreshCafe24Token(mall);
          response = await fetchOrders(token);
        } else {
          throw e;
        }
      }

      const orders = response.data.orders || [];
      console.log(`[Cafe24 Sync] Fetched ${orders.length} orders from Cafe24 API (Period: ${queryStart} ~ ${queryEnd})`);

      for (const order of orders) {
        // 주문한 상품들 배열 만들기
        let formattedItems = [];
        if (order.items && order.items.length > 0) {
          formattedItems = order.items.map(item => {
            const code = item.product_code || item.custom_product_code || '';
            const customCode = item.custom_product_code ? String(item.custom_product_code).trim() : '';
            
            let matchedPartId = null;
            if (customCode && barcodeToPartIdMap[customCode]) {
              matchedPartId = barcodeToPartIdMap[customCode]; // 1. Barcode match
            } else if (code && manualCodeToPartIdMap[code]) {
              matchedPartId = manualCodeToPartIdMap[code]; // 2. Manual match fallback
            }

            return {
              product_code: code,
              custom_product_code: customCode,
              name: item.product_name,
              quantity: item.quantity,
              price: item.product_price,
              payment_amount: Number(item.payment_amount || 0) || (Number(item.product_price || 0) - Number(item.coupon_discount_price || 0) - Number(item.app_discount_amount || 0)),
              discount_amount: Number(item.coupon_discount_price || 0) + Number(item.app_discount_amount || 0) + Number(item.additional_discount_price || 0),
              options: item.option_value || '',
              part_id: matchedPartId
            };
          });
        }

        const payload = {
          mall_id: mall_id,
          order_id: order.order_id,
          order_date: order.order_date,
          // Cafe24 API v2 return order.actual_order_amount as an object. We want a flat number.
          total_amount: order.payment_amount || (order.actual_order_amount && order.actual_order_amount.order_price_amount) || order.total_order_price || 0,
          order_items: formattedItems,
          status: order.order_status || order.shipping_status || 'unknown',
          buyer_name: order.buyer ? order.buyer.name : null,
          buyer_phone: order.buyer ? order.buyer.phone || order.buyer.cellphone : null,
          synced_at: new Date().toISOString()
        };

        // DB에 존재하는지 확인
        const { data: existing } = await supabaseAdmin.from('cafe24_orders')
          .select('id')
          .eq('order_id', order.order_id)
          .maybeSingle();

        let err = null;
        if (existing) {
          err = (await supabaseAdmin.from('cafe24_orders').update(payload).eq('id', existing.id)).error;
          if (err) {
            console.error(`[DB Update Error] Order ${order.order_id}:`, err);
            totalSkipped++;
          } else {
            totalUpdated++;
          }
        } else {
          err = (await supabaseAdmin.from('cafe24_orders').insert(payload)).error;
          if (err) {
            console.error(`[DB Insert Error] Order ${order.order_id}:`, err);
            totalSkipped++;
          } else {
            totalInserted++;
          }
        }
      }

      res.json({ success: true, message: `주문 동기화 완료: ${totalInserted}개 신규, ${totalUpdated}개 갱신 (기간: ${queryStart} ~ ${queryEnd})` });
    } catch (e) {
      console.error('[Cafe24 Order Sync Error]', e.response?.data || e.message);
      const errorMessage = e.response?.data?.error?.message || e.message;
      res.status(500).json({ error: errorMessage });
    }
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

  // 4. 수동 매핑 추가/수정 API
  router.post('/mappings', async (req, res) => {
    try {
      const { mall_id, cafe24_product_code, part_id } = req.body;
      if (!mall_id || !cafe24_product_code || !part_id) {
         return res.status(400).json({ error: '필수 파라미터 누락' });
      }

      // 기존 매핑 제거 (중복 방지)
      await supabaseAdmin.from('cafe24_product_to_part').delete()
        .eq('mall_id', mall_id)
        .eq('cafe24_product_code', cafe24_product_code);

      const { error: insError } = await supabaseAdmin.from('cafe24_product_to_part').insert({
        mall_id, cafe24_product_code, part_id
      });
      if (insError) throw insError;

      res.json({ success: true, message: '매핑이 저장되었습니다.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
