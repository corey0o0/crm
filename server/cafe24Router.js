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

    // Fetch all parts from parts table once for quick lookup
    const { data: partsList } = await supabaseAdmin.from('parts').select('id, name, barcode');
    const barcodeToPartsMap = {};
    const nameToPartsMap = {};
    (partsList || []).forEach(p => {
      if(p.barcode) {
        const bc = String(p.barcode).replace(/[^0-9]/g, '');
        if (bc) {
          if(!barcodeToPartsMap[bc]) barcodeToPartsMap[bc] = [];
          barcodeToPartsMap[bc].push({ id: p.id, name: p.name });
        }
      }
      if(p.name) {
        const pName = String(p.name).trim();
        if(!nameToPartsMap[pName]) nameToPartsMap[pName] = [];
        nameToPartsMap[pName].push({ id: p.id, name: p.name });
      }
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
      if (a.cafe24_member_id) {
        a.cafe24_member_id.split(',').forEach(id => {
          if (id.trim()) cafe24ToAgencyMap[id.trim()] = a.id;
        });
      }
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

    // 미완료된 과거 주문들도 상태 갱신을 위해 추가 조회
    try {
      const { data: incompleteDbOrders } = await supabaseAdmin
        .from('cafe24_orders')
        .select('order_id')
        .eq('mall_id', mall_id)
        .in('status', ['N10', 'N20', 'N21', 'N22', 'N30', 'N40', 'M', 'T', 'W', 'unknown']);

      if (incompleteDbOrders && incompleteDbOrders.length > 0) {
        const alreadyFetchedOrderIds = new Set(allOrders.map(o => o.order_id));
        const orderIdsToFetch = incompleteDbOrders
          .map(o => o.order_id)
          .filter(id => !alreadyFetchedOrderIds.has(id));

        if (orderIdsToFetch.length > 0) {
          console.log(`[Cafe24 Sync] API로 과거 미완료 주문 ${orderIdsToFetch.length}건 추가 상태 조회 시도...`);
          for (let i = 0; i < orderIdsToFetch.length; i += 100) {
            const chunkIds = orderIdsToFetch.slice(i, i + 100).join(',');
            const fetchOldOrders = async (token) => {
               return await axios.get(`https://${mall_id}.cafe24api.com/api/v2/admin/orders`, {
                 params: { order_id: chunkIds, embed: 'items,buyer,receivers' },
                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': '2026-03-01' }
               });
            };
            
            let res;
            try {
              res = await fetchOldOrders(tokenForRequest);
            } catch (e) {
              if (e.response && e.response.status === 401) {
                const { data: mall } = await supabaseAdmin.from('cafe24_settings').select('*').eq('mall_id', mall_id).single();
                tokenForRequest = await refreshCafe24Token(mall);
                res = await fetchOldOrders(tokenForRequest);
              } else { throw e; }
            }
            if (res.data && res.data.orders) {
               allOrders = allOrders.concat(res.data.orders);
            }
          }
        }
      }
    } catch (oldOrderErr) {
      console.error('[Cafe24 Sync] 과거 미완료 주문 조회 중 오류 (수집은 계속진행):', oldOrderErr.message);
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
          const customCode = (item.custom_variant_code || item.custom_item_code || item.custom_product_code) ? String(item.custom_variant_code || item.custom_item_code || item.custom_product_code).trim() : '';
          
          const cleanCodeForBarcode = String(code).replace(/[^0-9]/g, '');
          const cleanCustomCodeForBarcode = String(customCode).replace(/[^0-9]/g, '');
          
          let matchedPartId = null;
          
          const resolvePartId = (matchedPartsArray, itemName, itemOptions) => {
            if (matchedPartsArray.length === 1) return matchedPartsArray[0].id;
            const searchStr = `${itemName || ''} ${itemOptions || ''}`.toLowerCase();
            const words = searchStr.split(/[\s,()\[\]\-_=+./]+/).filter(w => w.length >= 2);
            let bestPart = matchedPartsArray[0];
            let maxMatches = -1;
            for (const part of matchedPartsArray) {
              const partName = (part.name || '').toLowerCase();
              let matches = 0;
              for (const word of words) {
                if (partName.includes(word)) matches++;
              }
              if (matches > maxMatches) {
                maxMatches = matches;
                bestPart = part;
              }
            }
            return bestPart.id;
          };

          if (cleanCustomCodeForBarcode && barcodeToPartsMap[cleanCustomCodeForBarcode]) {
            // 1) 자체 품목코드
            matchedPartId = resolvePartId(barcodeToPartsMap[cleanCustomCodeForBarcode], item.product_name, item.option_value);
          } else if (cleanCodeForBarcode && barcodeToPartsMap[cleanCodeForBarcode]) {
            // 2) 자체 상품코드 (바코드 매칭)
            matchedPartId = resolvePartId(barcodeToPartsMap[cleanCodeForBarcode], item.product_name, item.option_value);
          } else if (customCode && manualCodeToPartIdMap[customCode]) {
            // 2.5) 자체 상품코드 (수동 매핑 테이블) - 자체 코드 우선
            matchedPartId = manualCodeToPartIdMap[customCode];
          } else if (code && manualCodeToPartIdMap[code]) {
            // 2.6) 상품코드 (수동 매핑 테이블) - 일반 코드 후순위
            matchedPartId = manualCodeToPartIdMap[code];
          } else if (item.raw_custom_variant_code && manualCodeToPartIdMap[item.raw_custom_variant_code.trim()]) {
            matchedPartId = manualCodeToPartIdMap[item.raw_custom_variant_code.trim()];
          } else if (item.product_name && nameToPartsMap[item.product_name.trim()]) {
            // 3) 상품명
            matchedPartId = resolvePartId(nameToPartsMap[item.product_name.trim()], item.product_name, item.option_value);
          }

          const itemDiscount = Number(item.app_item_discount_amount || 0) + Number(item.additional_discount_price || 0) + Number(item.set_product_discount_amount || 0);
          const bundleDiscount = Number(item.coupon_discount_price || 0) + Number(item.shipping_fee_discount_amount || 0);

          return {
            product_code: code,
            custom_product_code: customCode,
            raw_custom_variant_code: String(item.custom_variant_code || '').trim(),
            raw_custom_product_code: String(item.custom_product_code || '').trim(),
            name: item.product_name,
            quantity: item.quantity,
            price: item.product_price,
            item_discount: itemDiscount,
            bundle_discount: bundleDiscount,
            discount_amount: itemDiscount + bundleDiscount,
            payment_amount: (item.payment_amount !== null && item.payment_amount !== undefined && Number(item.payment_amount) > 0) 
              ? Number(item.payment_amount) 
              : Math.max(0, (Number(item.product_price || 0) * Number(item.quantity || 1)) - itemDiscount - bundleDiscount),
            options: item.option_value || '',
            part_id: matchedPartId,
            order_status: item.order_status,
            payment_method: order.payment_method_name ? order.payment_method_name.join(',') : (order.payment_method ? order.payment_method.join(',') : '')
          };
        });
      }

      const pg_payment = Number(order.payment_amount || 0) + Number(order.naver_point || 0) + Number(order.prepaid_amount || 0);
      const actual_deposit = Number(order.deposit || (order.actual_order_amount && order.actual_order_amount.deposit) || 0);
      
      const isFullPoints = Number(order.actual_order_amount?.order_price_amount) > 0 && pg_payment === 0 && actual_deposit === 0;
      const isPartiallyCanceled = order.canceled === 'M' || (order.items && order.items.some(i => ['C11','C40','R40','E40'].includes(i.order_status)));

      let total_amount;
      if (isPartiallyCanceled && order.actual_order_amount) {
        total_amount = Number(order.actual_order_amount.order_price_amount || 0) + Number(order.actual_order_amount.shipping_fee || 0);
      } else {
        total_amount = pg_payment > 0 || actual_deposit > 0 || isFullPoints
          ? (pg_payment + actual_deposit) 
          : ((order.actual_order_amount && order.actual_order_amount.order_price_amount) || order.total_order_price || 0);
      }
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
        status: (order.items && order.items.length > 0 && order.items.some(i => i.order_status === 'N50')) 
                ? 'N50'
                : (order.items && order.items.length > 0 && order.items.some(i => i.order_status === 'N40'))
                  ? 'N40'
                  : ((order.items && order.items.length > 0 && order.items[0].order_status) || order.order_status || order.shipping_status || 'unknown'),
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

    // 1. 기존 DB에 있던 주문 식별을 위한 사전 일괄 조회 (통계 기록용 및 기존 매칭/창고 보존용)
    const orderIds = payloads.map(p => p.order_id);
    const existingOrderMap = new Map();
    const FETCH_CHUNK = 200;
    for (let i = 0; i < orderIds.length; i += FETCH_CHUNK) {
      const chunk = orderIds.slice(i, i + FETCH_CHUNK);
      const { data } = await supabaseAdmin.from('cafe24_orders').select('order_id, is_transferred, order_items, total_amount, shipping_fee, used_points').in('order_id', chunk);
      if (data) {
        data.forEach(row => existingOrderMap.set(row.order_id, { 
          items: row.order_items, 
          isTransferred: row.is_transferred,
          total_amount: row.total_amount,
          shipping_fee: row.shipping_fee,
          used_points: row.used_points
        }));
      }
    }

    // 기존 매칭된 part_id(전송완료 건)와 _warehouse_id를 새 payload의 order_items에 병합
    payloads.forEach(p => {
      const existingData = existingOrderMap.get(p.order_id);
      if (existingData) {
        if (existingData.isTransferred) {
          // 전송 완료된 주문은 최상위 금액 관련 필드도 엄격히 보존 (매출 통계/입출고와 어긋나지 않도록)
          if (existingData.total_amount !== undefined) p.total_amount = existingData.total_amount;
          if (existingData.shipping_fee !== undefined) p.shipping_fee = existingData.shipping_fee;
          if (existingData.used_points !== undefined) p.used_points = existingData.used_points;
        }

        if (existingData.items && Array.isArray(existingData.items) && p.order_items) {
          p.order_items = p.order_items.map((newItem, idx) => {
          const eItem = existingData.items[idx];
          if (eItem) {
            if (existingData.isTransferred) {
              // 전송 완료 건은 기존 DB 정보(상품명, 수량, 매핑, 창고 등)를 엄격히 보존
              const mergedItem = { ...eItem, order_status: newItem.order_status };
              
              // 단, 과거 버그로 인해 part_id가 null로 유실된 상태인데 
              // 이번 동기화에서 새롭게 매칭된 part_id가 있다면 복구를 위해 채워줌
              if (!eItem.part_id && newItem.part_id) {
                mergedItem.part_id = newItem.part_id;
              }
              
              return mergedItem;
            } else {
              // 미전송 건은 최신 Cafe24 데이터를 우선하되, 
              // 사용자가 지정했을 수 있는 출고 창고(_warehouse_id)는 보존
              const mergedItem = { ...newItem };
              if (eItem._warehouse_id) mergedItem._warehouse_id = eItem._warehouse_id;
              // 수동으로 저장된 part_id도 보존 (동기화 시 날아가는 것 방지)
              if (eItem.part_id) mergedItem.part_id = eItem.part_id;
              return mergedItem;
            }
          }
          return newItem;
        });
        }
      }
    });

    // 통계 계산
    payloads.forEach(p => {
      if (existingOrderMap.has(p.order_id)) totalUpdated++;
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
        if (existingOrderMap.has(chunk[0].order_id)) totalUpdated -= chunk.length;
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
  // 3.5. 수동 매핑 목록 조회 API
  router.get('/mappings', async (req, res) => {
    console.log('[API] GET /mappings called');
    try {
      const { data, error } = await supabaseAdmin
        .from('cafe24_product_to_part')
        .select(`
          mall_id, 
          cafe24_product_code, 
          part_id,
          parts ( name )
        `);
      if (error) throw error;
      res.json(data);
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

      // 즉시 기존 미전송 주문들에 반영
      const { data: activeOrders } = await supabaseAdmin.from('cafe24_orders').select('id, order_items').eq('mall_id', mall_id).eq('is_transferred', false).eq('is_deleted', false);
      if (activeOrders && activeOrders.length > 0) {
        for (const o of activeOrders) {
           if (!o.order_items) continue;
           let modified = false;
           const newItems = o.order_items.map(item => {
              const codes = [
                item.raw_custom_variant_code,
                item.raw_custom_product_code,
                item.custom_product_code,
                item.product_code
              ].filter(Boolean).map(c => String(c).trim());
              
              if (codes.includes(String(cafe24_product_code).trim())) {
                 modified = true;
                 return { ...item, part_id: part_id };
              }
              return item;
           });
           if (modified) {
             await supabaseAdmin.from('cafe24_orders').update({ order_items: newItems }).eq('id', o.id);
           }
        }
      }

      res.json({ success: true, message: '매핑이 저장되었습니다.' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4.5. 수동 매핑 삭제 API
  router.delete('/mappings', async (req, res) => {
    try {
      const { mall_id, cafe24_product_code } = req.body;
      if (!mall_id || !cafe24_product_code) {
         return res.status(400).json({ error: '필수 파라미터 누락' });
      }

      const { error } = await supabaseAdmin.from('cafe24_product_to_part').delete()
        .eq('mall_id', mall_id)
        .eq('cafe24_product_code', cafe24_product_code);
        
      if (error) throw error;
      res.json({ success: true, message: '매핑이 삭제되었습니다.' });
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

      // 3. 일괄 조회 (Bulk Fetch) 단계
      const uniqueProductCodes = new Set();
      orders.forEach(order => {
        (order.order_items || []).forEach(item => {
          if (!item.part_id) {
            const pCode = item.custom_product_code || item.product_code || '';
            if (pCode) uniqueProductCodes.add(String(pCode).trim());
          }
        });
      });

      const partsCacheByCode = {};
      const partsCacheById = {}; 
      if (uniqueProductCodes.size > 0) {
        // 500개씩 끊어서 조회 (PostgREST URL 길이 제한 방지)
        const codesArray = Array.from(uniqueProductCodes);
        for(let i=0; i<codesArray.length; i+=200) {
          const { data: pData } = await supabaseAdmin.from('parts')
            .select('id, code, supplier')
            .in('code', codesArray.slice(i, i+200));
          (pData || []).forEach(p => {
            partsCacheByCode[String(p.code).trim()] = p;
            partsCacheById[p.id] = p;
          });
        }
      }

      // 필수적으로 쓰일 트랜잭션과 인벤토리 정보 집계
      const requiredInventoryKeys = new Set(); // FORMAT: 'warehouseId_partId'
      const itemsToDeduct = [];

      orders.forEach(order => {
        const items = order.order_items || [];
        items.forEach((item, index) => {
          // 부분 취소/반품/교환 건은 재고 차감 및 매출 연동에서 제외
          const isCancelled = ['C11', 'C40', 'R40', 'E40'].includes(item.order_status);
          if (isCancelled) return;

          let wid = (warehouseConfig && warehouseConfig[order.id] && warehouseConfig[order.id][index]) || 'DEFAULT';
          
          let mappedPartId = item.part_id;
          if (!mappedPartId) {
            const pCode = item.custom_product_code || item.product_code || '';
            if (pCode && partsCacheByCode[String(pCode).trim()]) {
              mappedPartId = partsCacheByCode[String(pCode).trim()].id;
            }
          }

          if (mappedPartId) {
             const supplier = partsCacheById[mappedPartId]?.supplier || 'XRB';
             itemsToDeduct.push({ order, item, wid, mappedPartId, supplier });
             if (wid !== 'DEFAULT') {
               requiredInventoryKeys.add(`${wid}_${mappedPartId}`);
             }
          }
        });
      });

      // 일괄 재고 조회 (현재 재고)
      const currentInventoryMap = {}; 
      if (requiredInventoryKeys.size > 0) {
        const wIds = Array.from(new Set(Array.from(requiredInventoryKeys).map(k => k.split('_')[0])));
        const pIds = Array.from(new Set(Array.from(requiredInventoryKeys).map(k => k.split('_')[1])));
        
        let invDataArray = [];
        for(let w=0; w<wIds.length; w+=100) {
          for(let p=0; p<pIds.length; p+=100) {
             const { data: invData } = await supabaseAdmin.from('inventory')
               .select('warehouse_id, product_id, quantity')
               .in('warehouse_id', wIds.slice(w, w+100))
               .in('product_id', pIds.slice(p, p+100));
             if (invData) invDataArray = invDataArray.concat(invData);
          }
        }
        invDataArray.forEach(row => {
           currentInventoryMap[`${row.warehouse_id}_${row.product_id}`] = row.quantity;
        });
      }

      // 4. 일괄 데이터 준비 (메모리 연산)
      const transactionsToInsert = [];
      const inventoryLogsToInsert = [];
      const inventoryToUpsertMap = {}; 
      
      itemsToDeduct.forEach(({ order, item, wid, mappedPartId, supplier }) => {
         const orderDateStr = order.order_date ? new Date(order.order_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
         const wName = warehouseMap[wid] || '기본창고';
         
         transactionsToInsert.push({
            group_id: order.agency_id && !isNaN(order.agency_id) ? Number(order.agency_id) : null,
            type: 'out',
            product_id: mappedPartId,
            product_name: item.name,
            product_code: item.custom_product_code || item.product_code || '',
            product_supplier: supplier,
            quantity: Number(item.quantity || 1),
            to_location: String(order.agency_id || 'B2C'),
            from_location: wid !== 'DEFAULT' ? wid : 'NEARBIKE',
            date: orderDateStr,
            note: `[카페24 ${order.agency_id ? 'B2B 자동전송' : 'B2C 전송'}] 주문: ${order.order_id} (출고처:${wName})`,
            is_grouped: (order.order_items || []).length > 1,
            status: '완료'
         });

         if (wid !== 'DEFAULT') {
            const invKey = `${wid}_${mappedPartId}`;
            // 누적 계산을 위해 map에 들어있는 최신 개수 확인
            let prevQty = currentInventoryMap[invKey] || 0;
            if (inventoryToUpsertMap[invKey] !== undefined) {
               prevQty = inventoryToUpsertMap[invKey].quantity;
            }
            
            const newQty = prevQty - Number(item.quantity || 1);
            
            inventoryToUpsertMap[invKey] = {
               warehouse_id: wid,
               product_id: mappedPartId,
               quantity: newQty,
               updated_at: new Date().toISOString()
            };

            inventoryLogsToInsert.push({
               part_id: mappedPartId,
               part_name: item.name,
               part_code: item.custom_product_code || item.product_code || '',
               brand_code: ((item.custom_product_code || item.product_code || '').toUpperCase().startsWith('NB') || (item.custom_product_code || item.product_code || '').toUpperCase().includes('NEARBIKE')) || (item.name && (item.name.toUpperCase().startsWith('NB') || item.name.includes('니어'))) ? 'NB' : 'XRB',
               change_type: 'shipment_complete',
               quantity_change: -(Number(item.quantity || 1)),
               previous_quantity: prevQty,
               new_quantity: newQty,
               reference_id: order.id,
               reference_type: 'cafe24_order',
               notes: `온라인 주문 즉시 재고 차감 (주문번호: ${order.order_id})`
            });
         }
      });

      // 5. DB 일괄 업데이트 실행 (Bulk Execution)
      if (transactionsToInsert.length > 0) {
        for (let i = 0; i < transactionsToInsert.length; i += 500) {
           await supabaseAdmin.from('transactions').insert(transactionsToInsert.slice(i, i + 500));
        }
      }

      const invUpsertArray = Object.values(inventoryToUpsertMap);
      if (invUpsertArray.length > 0) {
        for (let i = 0; i < invUpsertArray.length; i += 500) {
           await supabaseAdmin.from('inventory').upsert(invUpsertArray.slice(i, i + 500), { onConflict: 'warehouse_id,product_id' });
        }
      }

      if (inventoryLogsToInsert.length > 0) {
        for (let i = 0; i < inventoryLogsToInsert.length; i += 500) {
           await supabaseAdmin.from('inventory_logs').insert(inventoryLogsToInsert.slice(i, i + 500));
        }
      }

      // 최종 상태 변경 (개별 order_items에 _warehouse_id 기록)
      for (const order of orders) {
        const updatedItems = (order.order_items || []).map((item, index) => {
          const wid = (warehouseConfig && warehouseConfig[order.id] && warehouseConfig[order.id][index]) || 'DEFAULT';
          return { ...item, _warehouse_id: wid };
        });
        await supabaseAdmin.from('cafe24_orders').update({ is_transferred: true, is_deleted: false, order_items: updatedItems }).eq('id', order.id);
      }

      res.json({ success: true, message: `${orders.length}건 일괄 전송(출고/차감) 완료` });
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
               brand_code: (log.part_code && (log.part_code.toUpperCase().startsWith('NB') || log.part_code.toUpperCase().includes('NEARBIKE'))) || (log.part_name && (log.part_name.toUpperCase().startsWith('NB') || log.part_name.includes('니어'))) ? 'NB' : 'XRB',
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

  // 7. 출고 완료된 주문의 재고를 부분 입고(환입) 처리하는 API
  router.post('/transfer/return-inventory', async (req, res) => {
    try {
      const { orderIds } = req.body;
      if (!orderIds || !orderIds.length) {
        return res.status(400).json({ error: '주문 ID가 제공되지 않았습니다.' });
      }

      let successCount = 0;
      let failCount = 0;
      let failMessages = [];

      for (const orderId of orderIds) {
        // 1. 주문 데이터 조회
        const { data: order, error: oErr } = await supabaseAdmin
          .from('cafe24_orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (oErr || !order) throw new Error('주문 데이터 조회 실패');
        if (!order.is_transferred) {
          failCount++; failMessages.push(`${order.order_id}: 아직 전송(출고)되지 않은 주문입니다.`); continue;
        }

        // 2. 출고 확정(검수 완료) 상태 확인
        const { data: poHeader } = await supabaseAdmin.from('pending_outbounds').select('id, status').eq('order_no', order.order_id).maybeSingle();
        if (!poHeader || poHeader.status !== '완료') {
          failCount++; failMessages.push(`${order.order_id}: 아직 검수가 완료되지 않은 주문입니다. [전송 취소] 기능을 이용해주세요.`); continue;
        }

        // 3. 재고 환입 처리
        const items = order.order_items || [];
        const { data: warehouses } = await supabaseAdmin.from('warehouses').select('id, name');
        const defaultWh = warehouses.find(w => w.name.includes('청담') || w.name.includes('본점'));
        const defaultWhId = defaultWh ? defaultWh.id : null;
        const warehouseMap = {};
        (warehouses || []).forEach(w => { warehouseMap[w.id] = w.name; });

        for (const item of items) {
          let wid = item._warehouse_id || defaultWhId;
          if (!wid || wid === 'DEFAULT') wid = defaultWhId;
          const mappedPartId = item.part_id;
          
          if (!mappedPartId || !wid) continue;

          const qtyToReturn = Number(item.quantity || 1);

          // a. 현재 창고 재고 가져오기
          const { data: currentInv } = await supabaseAdmin.from('inventory')
            .select('quantity')
            .eq('warehouse_id', wid)
            .eq('product_id', mappedPartId)
            .maybeSingle();

          const currentQty = currentInv ? currentInv.quantity : 0;
          const newQty = currentQty + qtyToReturn;

          // b. 재고 업데이트 (+)
          await supabaseAdmin.from('inventory').upsert({
            warehouse_id: wid,
            product_id: mappedPartId,
            quantity: newQty,
            updated_at: new Date().toISOString()
          }, { onConflict: 'warehouse_id,product_id' });

          // c. 트랜잭션 기록 (입고)
          const wName = warehouseMap[wid] || '기본창고';
          await supabaseAdmin.from('transactions').insert({
            group_id: null,
            type: 'in',
            product_id: mappedPartId,
            product_name: item.name,
            product_code: item.custom_product_code || item.product_code || '',
            product_supplier: ((item.custom_product_code || item.product_code || '').toUpperCase().startsWith('NB') || (item.custom_product_code || item.product_code || '').toUpperCase().includes('NEARBIKE')) || (item.name && (item.name.toUpperCase().startsWith('NB') || item.name.includes('니어'))) ? 'NB' : 'XRB',
            quantity: qtyToReturn,
            from_location: String(order.buyer_name || order.agency_id || '고객반품'),
            to_location: wid,
            date: new Date().toISOString().split('T')[0],
            note: `[온라인 반품] 발송 완료된 주문 반품 복구 (주문번호: ${order.order_id})`,
            is_grouped: false,
            status: '완료'
          });

          // d. 인벤토리 로그 기록
          await supabaseAdmin.from('inventory_logs').insert({
            warehouse_id: wid,
            part_id: mappedPartId,
            part_name: item.name,
            part_code: item.custom_product_code || item.product_code || '',
            brand_code: ((item.custom_product_code || item.product_code || '').toUpperCase().startsWith('NB') || (item.custom_product_code || item.product_code || '').toUpperCase().includes('NEARBIKE')) || (item.name && (item.name.toUpperCase().startsWith('NB') || item.name.includes('니어'))) ? 'NB' : 'XRB',
            change_type: 'return',
            quantity_change: qtyToReturn,
            previous_quantity: currentQty,
            new_quantity: newQty,
            reference_id: order.id,
            reference_type: 'cafe24_return',
            notes: `온라인 주문 반품으로 인한 창고 재입고 처리 (주문번호: ${order.order_id})`
          });
        }

        // 처리 완료되면 is_transferred를 false로 풀어버려서 미전송 풀(pool)로 돌려 다시 무시 하든 재진행하든 자유도를 줍니다.
        await supabaseAdmin.from('cafe24_orders').update({ is_transferred: false }).eq('id', order.id);
        successCount++;
      }

      res.json({
        success: true,
        message: `총 ${successCount}건의 주문에 속한 품목들의 반품 재입고 처리가 정상 등록되었습니다.` + (failCount > 0 ? ` (실패: ${failCount}건)` : ''),
        failedDetails: failMessages
      });

    } catch(err) {
      console.error('[Return Inventory Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
