const express = require('express');

module.exports = (supabaseAdmin) => {
  const router = express.Router();

  // JWT 인증 검증 미들웨어
  const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '인증 토큰이 제공되지 않았습니다.' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ success: false, message: '유효하지 않거나 만료된 토큰입니다.' });
    }
    req.user = user;
    next();
  };

  // GET /api/agencies - List all agencies
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error('Error fetching agencies:', err);
      res.status(500).json({ success: false, message: '거래처 목록 조회 실패', error: err.message });
    }
  });

  // POST /api/agencies - Create single agency
  router.post('/', requireAuth, async (req, res) => {
    try {
      const agencyData = req.body;
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .insert([agencyData])
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error('Error creating agency:', err);
      res.status(500).json({ success: false, message: '거래처 등록 실패', error: err.message });
    }
  });

  // PUT /api/agencies/:id - Update agency
  router.put('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const agencyData = req.body;
      
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .update(agencyData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error('Error updating agency:', err);
      res.status(500).json({ success: false, message: '거래처 수정 실패', error: err.message });
    }
  });

  // DELETE /api/agencies/:id - Delete agency
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin
        .from('agencies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting agency:', err);
      res.status(500).json({ success: false, message: '거래처 삭제 실패', error: err.message });
    }
  });

  // POST /api/agencies/bulk - Bulk UPSERT for Excel Upload
  router.post('/bulk', requireAuth, async (req, res) => {
    try {
      const { items } = req.body; // Array of agency objects
      if (!items || !items.length) {
        return res.status(400).json({ success: false, message: '등록할 데이터가 없습니다.' });
      }

      // Upsert based on business_number (거래처코드).
      // Make sure business_number is not null for upserting properly
      const { data, error } = await supabaseAdmin
        .from('agencies')
        .upsert(items, { onConflict: 'business_number', ignoreDuplicates: false })
        .select();

      if (error) throw error;
      res.json({ success: true, count: data.length });
    } catch (err) {
      console.error('Error bulk uploading agencies:', err);
      res.status(500).json({ success: false, message: '거래처 일괄 등록 실패', error: err.message });
    }
  });

  return router;
};
