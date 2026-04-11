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

  // 1-2. 재고 비교 API (신규)
  router.get('/inventory/compare/:mall_id', async (req, res) => {
    try {
      const mallId = req.params.mall_id;
      const { data: mallSet } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', mallId).single();
      if (!mallSet || !mallSet.access_token) return res.status(400).json({ error: '쇼핑몰 미연동 혹은 토큰 없음' });

      let allVariants = [];
      let offset = 0;
      let limit = 100;
      
      while (true) {
        const resp = await axios.get(`https://${mallId}.cafe24api.com/api/v2/admin/products?embed=variants&limit=${limit}&offset=${offset}`, {
          headers: {
            'Authorization': `Bearer ${mallSet.access_token}`,
            'Content-Type': 'application/json',
            'X-Cafe24-Api-Version': '2026-03-01'
          }
        });
        
        const products = resp.data.products || [];
        if (products.length === 0) break;
        
        products.forEach(p => {
           if (p.variants) {
             p.variants.forEach(v => {
                if (v.custom_variant_code) {
                  allVariants.push({
                     product_no: p.product_no,
                     product_name: p.product_name,
                     variant_code: v.variant_code,
                     custom_variant_code: v.custom_variant_code,
                     quantity: v.use_inventory === 'T' ? parseInt(v.quantity || v.stock_quantity || 0) : null,
                     use_inventory: v.use_inventory === 'T',
                     display: v.display === 'T'
                  });
                }
             });
           }
        });
        offset += limit;
      }

      // 프론트엔드에서 바코드 기반 및 창고별 매칭을 수행할 수 있도록 전체 데이터를 그대로 반환
      res.json({ success: true, cafe24Variants: allVariants });
    } catch (e) {
      console.error('Cafe24 Inventory Compare Error:', e.response ? e.response.data : e.message);
      res.status(500).json({ error: '카페24 재고 데이터 수집 실패: ' + (e.response?.data?.error?.message || e.message) });
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

  // 백그라운드용 코어 수집 함수
  router.syncCafe24OrdersCore = async (mall_id, start_date, end_date) => {
    let token = await getValidToken(mall_id);
    let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;

    // 파라미터가 없으면 최근 3일 기준으로 설정
    const today = new Date();
    const lastPoint = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const queryStart = start_date || lastPoint.toISOString().split('T')[0];
    const queryEnd = end_date || today.toISOString().split('T')[0];

    // Fetch all barcodes and part_ids from parts table once for quick lookup
    const { data: partsList } = await supabaseAdmin.from('parts').select('id, barcode').not('barcode', 'is', null);
    const barcodeToPartIdMap = {};
    (partsList || []).forEach(p => {
      if(p.barcode) barcodeToPartIdMap[String(p.barcode).trim()] = p.id;
    });

    // Fetch manual product mappings (전체 브랜드 글로벌 기준 매칭 적용)
    const { data: manualMappings } = await supabaseAdmin.from('cafe24_product_to_part').select('cafe24_product_code, part_id');
    const manualCodeToPartIdMap = {};
    (manualMappings || []).forEach(m => {
      manualCodeToPartIdMap[String(m.cafe24_product_code).trim()] = m.part_id;
    });

    // Fetch agencies mapped to cafe24 member IDs
    const { data: agenciesList } = await supabaseAdmin.from('agencies').select('id, cafe24_member_id').not('cafe24_member_id', 'is', null).neq('cafe24_member_id', '');
    const cafe24ToAgencyMap = {};
    (agenciesList || []).forEach(a => {
      if (a.cafe24_member_id) cafe24ToAgencyMap[String(a.cafe24_member_id).trim()] = a.id;
    });

    const fetchOrders = async (accessToken, currentOffset) => {
      return await axios.get(`https://${mall_id}.cafe24api.com/api/v2/admin/orders`, {
        params: { start_date: queryStart, end_date: queryEnd, date_type: 'order_date', limit: 100, offset: currentOffset, embed: 'items,buyer,receivers' },
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
      });
    };

    let tokenForRequest = token;
    let allOrders = [];
    let currentOffset = 0;
    const limit = 100;

    while (true) {
      let response;
      try {
        response = await fetchOrders(tokenForRequest, currentOffset);
      } catch (e) {
        if (e.response && e.response.status === 401) {
          console.log('[Cafe24 API] 401 Unauthorized - Forcing token refresh...');
          const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', mall_id).single();
          tokenForRequest = await refreshCafe24Token(mall);
          response = await fetchOrders(tokenForRequest, currentOffset);
        } else {
          throw e;
        }
      }

      const batchOrders = response.data.orders || [];
      allOrders = allOrders.concat(batchOrders);
      if (batchOrders.length < limit) break;
      currentOffset += limit;
    }

    const excludedStatuses = ['N00', 'F']; // N30(배송완료/발송완료) 수집 허용 처리
    const validOrders = allOrders.filter(o => !excludedStatuses.includes(o.order_status));
    console.log(`[Cafe24 Sync] Fetched ${allOrders.length} orders from Cafe24 API, processing ${validOrders.length} valid orders`);

    const payloads = [];

    for (const order of validOrders) {
      // 주문한 상품들 배열 만들기
      let formattedItems = [];
      if (order.items && order.items.length > 0) {
        formattedItems = order.items.map(item => {
          const code = item.product_code || item.custom_product_code || '';
          const customCode = (item.custom_item_code || item.custom_product_code) ? String(item.custom_item_code || item.custom_product_code).trim() : '';
          
          let matchedPartId = null;
          if (customCode && barcodeToPartIdMap[customCode]) {
            matchedPartId = barcodeToPartIdMap[customCode]; // 1. Barcode match
          } else if (code && manualCodeToPartIdMap[code]) {
            matchedPartId = manualCodeToPartIdMap[code]; // 2. Manual match fallback
          }

          const itemDiscount = Number(item.app_item_discount_amount || 0) + Number(item.additional_discount_price || 0) + Number(item.set_product_discount_amount || 0);
          const bundleDiscount = Number(item.coupon_discount_price || 0) + Number(item.shipping_fee_discount_amount || 0);

          return {
            product_code: code,
            custom_product_code: customCode,
            name: item.product_name,
            quantity: item.quantity,
            price: item.product_price,
            item_discount: itemDiscount,
            bundle_discount: bundleDiscount,
            discount_amount: itemDiscount + bundleDiscount,
            payment_amount: Number(item.payment_amount || 0) || ((Number(item.product_price || 0) * Number(item.quantity || 1)) - itemDiscount - bundleDiscount),
            options: item.option_value || '',
            part_id: matchedPartId
          };
        });
      }

      const pg_payment = Number(order.payment_amount || 0);
      const actual_deposit = Number(order.deposit || (order.actual_order_amount && order.actual_order_amount.deposit) || 0);
      
      const total_amount = pg_payment > 0 
        ? (pg_payment + actual_deposit) 
        : ((order.actual_order_amount && order.actual_order_amount.order_price_amount) || order.total_order_price || 0);
      const shipping_fee = Number((order.actual_order_amount && order.actual_order_amount.shipping_fee) || 0);

      let items_payment_sum = 0;
      if (formattedItems && formattedItems.length > 0) {
        items_payment_sum = formattedItems.reduce((acc, item) => acc + Number(item.payment_amount || 0), 0);
      }
      const used_points = Math.max(0, items_payment_sum + shipping_fee - Number(total_amount));

      const payload = {
        mall_id: mall_id,
        order_id: order.order_id,
        order_date: order.order_date,
        total_amount: total_amount,
        shipping_fee: shipping_fee,
        used_points: used_points,
        order_items: formattedItems,
        status: order.order_status || order.shipping_status || 'unknown',
        buyer_id: order.member_id || (order.buyer && order.buyer.member_id) || null,
        agency_id: cafe24ToAgencyMap[String(order.member_id || (order.buyer && order.buyer.member_id) || '').trim()] || null,
        buyer_group_no: (order.buyer && order.buyer.member_group_no) ? String(order.buyer.member_group_no) : null,
        member_authentication: order.member_authentication || null,
        buyer_name: (order.buyer && order.buyer.name) ? order.buyer.name : (order.billing_name || null),
        buyer_phone: order.buyer ? order.buyer.phone || order.buyer.cellphone : null,
        shipping_message: (order.receivers && order.receivers[0]) ? order.receivers[0].shipping_message : null,
        synced_at: new Date().toISOString()
      };
      
      payloads.push(payload);
    }

    // 1. 기존 DB에 있던 주문 식별을 위한 사전 일괄 조회 (통계 기록용)
    const orderIds = payloads.map(p => p.order_id);
    const existingOrderIds = new Set();
    const FETCH_CHUNK = 200;
    for (let i = 0; i < orderIds.length; i += FETCH_CHUNK) {
      const chunk = orderIds.slice(i, i + FETCH_CHUNK);
      const { data } = await supabaseAdmin.from('cafe24_orders').select('order_id').in('order_id', chunk);
      if (data) data.forEach(row => existingOrderIds.add(row.order_id));
    }

    // 통계 계산
    payloads.forEach(p => {
      if (existingOrderIds.has(p.order_id)) totalUpdated++;
      else totalInserted++;
    });

    // 2. 벌크 업서트 (일괄 저장 및 업데이트)
    const UPSERT_CHUNK = 200;
    for (let i = 0; i < payloads.length; i += UPSERT_CHUNK) {
      const chunk = payloads.slice(i, i + UPSERT_CHUNK);
      const { error: upsertErr } = await supabaseAdmin.from('cafe24_orders').upsert(chunk, { onConflict: 'order_id' });
      
      if (upsertErr) {
        console.error(`[Bulk Upsert Error] Chunk starting at ${i}:`, upsertErr);
        totalSkipped += chunk.length;
        if (existingOrderIds.has(chunk[0].order_id)) totalUpdated -= chunk.length;
        else totalInserted -= chunk.length;
      }
    }
    
    return { totalInserted, totalUpdated, totalSkipped, queryStart, queryEnd };
  };

  // 3-2. 주문 수동 동기화 API
  router.post('/sync/orders/:mall_id', async (req, res) => {
    try {
      const { mall_id } = req.params;
      const { start_date, end_date } = req.body;
      
      const result = await router.syncCafe24OrdersCore(mall_id, start_date, end_date);
      
      res.json({ success: true, message: `주문 동기화 완료: ${result.totalInserted}개 신규, ${result.totalUpdated}개 갱신 (기간: ${result.queryStart} ~ ${result.queryEnd})` });
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

  // 5. 선택된 주문 출고(매출) 분할 전송 API (다중 창고 대응)
  router.post('/transfer/orders', async (req, res) => {
    try {
      const { orderIds, warehouseConfig } = req.body;
      if (!orderIds || !orderIds.length) {
        return res.status(400).json({ error: '주문 ID가 제공되지 않았습니다.' });
      }

      // 1. 창고 정보 조회 (청담 판별용)
      const { data: warehouses } = await supabaseAdmin.from('warehouses').select('id, name');
      const warehouseMap = {};
      (warehouses || []).forEach(w => { warehouseMap[w.id] = w.name; });

      // 2. 주문 목록 가져오기
      const { data: orders, error: fetchErr } = await supabaseAdmin
        .from('cafe24_orders')
        .select('*')
        .in('id', orderIds)
        .eq('is_transferred', false);

      if (fetchErr) throw fetchErr;
      if (!orders || orders.length === 0) {
        return res.json({ success: true, message: '전송할 유효한 주문이 없습니다.' });
      }

      let transferCount = 0;

      // 3. 각 주문별로 출고(매출) 분할 생성
      for (const order of orders) {
        const orderDateStr = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const items = order.order_items || [];
        
        // 창고별로 아이템 그룹화
        const itemsByWarehouse = {};
        
        items.forEach((item, index) => {
          let wid = null;
          if (warehouseConfig && warehouseConfig[order.id] && warehouseConfig[order.id][index]) {
            wid = warehouseConfig[order.id][index];
          }
          if (!wid) wid = 'DEFAULT';

          if (!itemsByWarehouse[wid]) itemsByWarehouse[wid] = [];
          itemsByWarehouse[wid].push(item);
        });

        const warehouseIds = Object.keys(itemsByWarehouse);

        for (const wid of warehouseIds) {
          const wItems = itemsByWarehouse[wid];
          const wName = warehouseMap[wid] || '기본창고';
          const isCheongdam = wName.includes('청담');
          
          let totalQuantity = 0;
          let totalPrice = 0;
          let itemNames = [];
          let brandName = 'XRB';

          wItems.forEach(item => {
            totalQuantity += Number(item.quantity || 1);
            totalPrice += Number(item.payment_amount || (Number(item.price || 0) * Number(item.quantity || 1)));
            itemNames.push(item.name);
            if (item.name && item.name.includes('NB')) brandName = 'NB';
          });

          // 배송비는 한 주문에서 첫 번째 분할 출고건에만 부과 (중복 방지)
          if (warehouseIds.indexOf(wid) === 0) {
            totalPrice += Number(order.shipping_fee || 0);
          }

          const productName = itemNames.length > 1 ? `${itemNames[0]} 외 ${itemNames.length - 1}건` : (itemNames[0] || '상품 없음');

          // 항상 '완료' (즉시 출고) 처리
          const transactionStatus = '완료';

          const transactionsToInsert = [];
          for (const item of wItems) {
            let mappedPartId = item.part_id;
            let productSupplier = 'NEARBIKE';
            
            if (!mappedPartId) {
              const pCode = item.custom_product_code || item.product_code || '';
              if (pCode) {
                const { data: pData } = await supabaseAdmin.from('parts').select('id, supplier').eq('code', pCode).maybeSingle();
                if (pData) {
                  mappedPartId = pData.id;
                  if (pData.supplier) productSupplier = pData.supplier;
                }
              }
            } else {
              const { data: pData } = await supabaseAdmin.from('parts').select('supplier').eq('id', mappedPartId).maybeSingle();
              if (pData && pData.supplier) productSupplier = pData.supplier;
            }

            if (mappedPartId) {
                transactionsToInsert.push({
                 group_id: order.agency_id && !isNaN(order.agency_id) ? Number(order.agency_id) : null,
                 type: 'out',
                 product_id: mappedPartId,
                 product_name: item.name,
                 product_code: item.custom_product_code || item.product_code || '',
                 product_supplier: productSupplier,
                 quantity: Number(item.quantity || 1),
                 to_location: String(order.agency_id || 'B2C'),
                 from_location: wid !== 'DEFAULT' ? wid : 'NEARBIKE',
                 date: orderDateStr,
                 note: `[카페24 ${order.agency_id ? 'B2B 자동전송' : 'B2C 전송'}] 주문: ${order.order_id} (출고처:${wName})`,
                 is_grouped: wItems.length > 1,
                 status: transactionStatus
               });
            }
          }

          if (transactionsToInsert.length > 0) {
            const { data: insertedTxs, error: txErr } = await supabaseAdmin.from('transactions').insert(transactionsToInsert).select();
            if (txErr) console.error('[Transaction Insert Error]', txErr);

            // 대기(pending_outbounds) 절차 생략하고 바로 재고 차감만 수행
          }

          // ** 모든 창고에 대해 재고 즉시 차감 로직 실행 **
          if (wid !== 'DEFAULT') {
            try {
              for (const item of wItems) {
                let mappedPartId = item.part_id;
                if (!mappedPartId) {
                  const pCode = item.custom_product_code || item.product_code || '';
                  if (pCode) {
                    const { data: pData } = await supabaseAdmin.from('parts').select('id').eq('code', pCode).maybeSingle();
                    if (pData) mappedPartId = pData.id;
                  }
                }

                if (mappedPartId) {
                  const { data: currentInv } = await supabaseAdmin.from('inventory')
                    .select('quantity')
                    .eq('warehouse_id', wid)
                    .eq('product_id', mappedPartId)
                    .maybeSingle();
                  
                  const prevQty = currentInv ? currentInv.quantity : 0;
                  const newQty = prevQty - Number(item.quantity || 1);

                  await supabaseAdmin.from('inventory').upsert({
                     warehouse_id: wid,
                     product_id: mappedPartId,
                     quantity: newQty,
                     updated_at: new Date().toISOString()
                  }, { onConflict: 'warehouse_id,product_id' });

                  await supabaseAdmin.from('inventory_logs').insert({
                     part_id: mappedPartId,
                     part_name: item.name,
                     part_code: item.custom_product_code || item.product_code || '',
                     change_type: 'shipment_complete',
                     quantity_change: -(Number(item.quantity || 1)),
                     previous_quantity: prevQty,
                     new_quantity: newQty,
                     reference_id: order.id,
                     reference_type: 'cafe24_order',
                     notes: `온라인 주문 즉시 재고 차감 (주문번호: ${order.order_id})`
                  });
                }
              }
            } catch (invErr) {
              console.error(`[Inventory Transfer Error] order: ${order.id}`, invErr);
            }
          }
        } // end of warehouse split

        // 상태 업데이트
        await supabaseAdmin.from('cafe24_orders').update({ is_transferred: true }).eq('id', order.id);
        transferCount++;
      }

      res.json({ success: true, message: `${transferCount}건 분할 전송(출고/차감) 완료` });
    } catch (e) {
      console.error('[Transfer Error]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // 카페24 선택 주문건 판매 반영(전송) 개별/일괄 취소
  router.post('/transfer/cancel', async (req, res) => {
    try {
      const { orderIds } = req.body;
      if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ error: '취소할 주문 ID 목록이 없습니다.' });
      }

      const { data: orders, error: oErr } = await supabaseAdmin.from('cafe24_orders').select('*').in('id', orderIds);
      if (oErr || !orders) throw new Error('주문 데이터 조회 실패');

      let successCount = 0;
      let failCount = 0;
      let failMessages = [];

      for (const order of orders) {
        if (!order.is_transferred) {
           failCount++; failMessages.push(`${order.order_id}: 이미 미전송 상태입니다.`); continue;
        }

        // 1. 청담 창고 등, 검수 대기열(pending_outbounds) 확인
        const { data: poHeader } = await supabaseAdmin.from('pending_outbounds').select('id, status').eq('order_no', order.order_id).maybeSingle();
        // 옵션 A: 이미 검수 완료(출고 완료)된 건은 취소 불가 조치
        if (poHeader && poHeader.status === '완료') {
           failCount++; failMessages.push(`${order.order_id}: 매장/온라인 출고에서 이미 검수가 완료(출고 확정)되어 판매 전송을 취소할 수 없습니다.`); continue;
        }

        // 2. 대기열(pending_outbounds) 삭제 (연관 items 포함)
        if (poHeader) {
           await supabaseAdmin.from('pending_outbound_items').delete().eq('pending_id', poHeader.id);
           await supabaseAdmin.from('pending_outbounds').delete().eq('id', poHeader.id);
        }

        // 3. 기타 창고 즉시 차감분 인벤토리 롤백 (inventory_logs 역추적)
        const { data: invLogs } = await supabaseAdmin.from('inventory_logs')
          .select('*')
          .like('notes', `%주문번호: ${order.order_id}%`);
        
        if (invLogs && invLogs.length > 0) {
           for (const log of invLogs) {
             const { data: currentInv } = await supabaseAdmin.from('inventory')
               .select('quantity')
               .eq('warehouse_id', log.warehouse_id)
               .eq('product_id', log.part_id)
               .maybeSingle();

             const currentQty = currentInv ? currentInv.quantity : 0;
             const restoredQty = currentQty + Math.abs(log.quantity_change);

             await supabaseAdmin.from('inventory').upsert({
               warehouse_id: log.warehouse_id,
               product_id: log.part_id,
               quantity: restoredQty,
               updated_at: new Date().toISOString()
             }, { onConflict: 'warehouse_id,product_id' });

             await supabaseAdmin.from('inventory_logs').insert({
               warehouse_id: log.warehouse_id,
               part_id: log.part_id,
               part_name: log.part_name,
               part_code: log.part_code,
               change_type: 'cancellation',
               quantity_change: Math.abs(log.quantity_change),
               previous_quantity: currentQty,
               new_quantity: restoredQty,
               reference_id: log.reference_id,
               reference_type: 'shipment_cancel',
               notes: `온라인 주문 전송 취소로 인한 재고 원복 (주문번호: ${order.order_id})`
             });
           }
        }

        // 4. 거래내역(transactions) 취소 기록 삭제
        await supabaseAdmin.from('transactions').delete().like('note', `%주문: ${order.order_id}%`);

        // 5. 생성된 배송/출고 기록(shipments) 삭제
        const { data: shipments } = await supabaseAdmin.from('shipments').select('id').eq('tracking_number', order.order_id);
        if (shipments && shipments.length > 0) {
           for (const s of shipments) {
              await supabaseAdmin.from('shipment_parts').delete().eq('shipment_id', s.id);
              await supabaseAdmin.from('shipments').delete().eq('id', s.id);
           }
        }

        // 6. 상태 초기화
        await supabaseAdmin.from('cafe24_orders').update({ is_transferred: false }).eq('id', order.id);

        successCount++;
      }

      res.json({
        success: true,
        message: `전송 취소 성공: ${successCount}건` + (failCount > 0 ? ` (실패/거부: ${failCount}건)` : ''),
        failedDetails: failMessages
      });

    } catch(err) {
      console.error('[Cancel Transfer Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
