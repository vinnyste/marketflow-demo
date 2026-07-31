import { supabase } from '@/lib/supabase';
import { Address } from '@/types/database';

export const addressesService = {
  async getByUser(userId: string): Promise<Address[]> {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(address: Omit<Address, 'id' | 'created_at'>): Promise<Address> {
    // Check if this is the user's first address — auto-set as default
    const { count } = await supabase
      .from('addresses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', address.user_id);

    const shouldBeDefault = address.is_default || (count === 0);

    if (shouldBeDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', address.user_id);
    }

    const { data, error } = await supabase
      .from('addresses')
      .insert({ ...address, is_default: shouldBeDefault })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Address>): Promise<Address> {
    if (updates.is_default && updates.user_id) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', updates.user_id);
    }

    const { data, error } = await supabase
      .from('addresses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) throw error;
  },

  async setDefault(id: string, userId: string) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId);

    const { data, error } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
