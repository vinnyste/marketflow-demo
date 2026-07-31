import { supabase } from '@/lib/supabase';
import { Promotion } from '@/types/database';

export const promotionsService = {
  async getActive(): Promise<Promotion[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('promotions')
      .select('*, product:products(id, name, price, image_url, unit)')
      .eq('active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`);
    if (error) return [];
    return data as Promotion[];
  },

  async getAll(): Promise<Promotion[]> {
    const { data, error } = await supabase
      .from('promotions')
      .select('*, product:products(id, name, price, image_url, unit)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Promotion[];
  },

  async create(payload: Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'product'>): Promise<Promotion> {
    const { data, error } = await supabase
      .from('promotions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Promotion;
  },

  async update(id: string, payload: Partial<Omit<Promotion, 'id' | 'created_at' | 'product'>>): Promise<Promotion> {
    const { data, error } = await supabase
      .from('promotions')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Promotion;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) throw error;
  },
};
