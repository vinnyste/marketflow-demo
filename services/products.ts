import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';

export const productsService = {
  async getAll(filters?: {
    categoryId?: string;
    featured?: boolean;
    search?: string;
    active?: boolean;
  }) {
    const pageSize = 1000;
    const products: Product[] = [];

    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from('products')
        .select('*, category:categories(*)')
        .order('name')
        .range(from, from + pageSize - 1);

      if (filters?.active !== false) {
        query = query.eq('active', true);
      }
      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.featured) {
        query = query.eq('featured', true);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      products.push(...((data || []) as Product[]));
      if (!data || data.length < pageSize) break;
    }

    return products;
  },

  async getById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as Product;
  },

  async create(product: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },
};
