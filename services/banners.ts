import { supabase } from '@/lib/supabase';
import { Banner } from '@/types/database';

export const bannersService = {
  async getActive(): Promise<Banner[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('sort_order');
    if (error) return [];
    return data as Banner[];
  },

  async getAll(): Promise<Banner[]> {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    return data as Banner[];
  },

  async create(payload: Omit<Banner, 'id' | 'created_at' | 'updated_at'>): Promise<Banner> {
    const { data, error } = await supabase
      .from('banners')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  async update(id: string, payload: Partial<Omit<Banner, 'id' | 'created_at'>>): Promise<Banner> {
    const { data, error } = await supabase
      .from('banners')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw error;
  },
};
