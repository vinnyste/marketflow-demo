import { supabase } from '@/lib/supabase';
import { Category } from '@/types/database';

export const categoriesService = {
  async getAll(onlyActive = true) {
    let query = supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (onlyActive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Category[];
  },

  async getById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async create(category: Partial<Category>) {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Category>) {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },
};
