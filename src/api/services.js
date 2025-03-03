import { supabase } from '../lib/supabaseClient'

export const serviceApi = {
  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching services:', error)
      throw error
    }
  },

  getByBrand: async (brand) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('brand', brand)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching services by brand:', error)
      throw error
    }
  },

  create: async (serviceData) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .insert([serviceData])
        .select()
      
      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Error creating service:', error)
      throw error
    }
  },

  update: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
      
      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Error updating service:', error)
      throw error
    }
  },

  delete: async (id) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting service:', error)
      throw error
    }
  }
} 