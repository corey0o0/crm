const express = require('express');

module.exports = (supabaseAdmin) => {
  const router = express.Router();

  // GET /api/agencies - List all agencies
  router.get('/', async (req, res) => {
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
  router.post('/', async (req, res) => {
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
  router.put('/:id', async (req, res) => {
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
  router.delete('/:id', async (req, res) => {
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
  router.post('/bulk', async (req, res) => {
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
