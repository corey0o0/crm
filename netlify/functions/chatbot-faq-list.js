'use strict';
const { getSupabase, ok, err, preflight } = require('./_chatbot_utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return err(405, 'GET only');

  const brand = (event.queryStringParameters?.brand || 'nb').toUpperCase();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('faq_items')
    .select('label, keywords, answer, category, sort_order')
    .in('brand', ['SHARED', brand])
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[chatbot-faq-list] DB error:', error);
    return err(500, 'DB error');
  }

  if (!data || data.length === 0) {
    return ok({ faqs: [], empty: true });
  }

  return ok({ faqs: data });
};
