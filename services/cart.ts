import { supabase } from '@/lib/supabase';
import { CartItem } from '@/types/database';

export const cartService = {
  async getItems(userId: string): Promise<CartItem[]> {
    const { data, error } = await supabase
      .from('cart_items')
      .select('*, product:products(*, category:categories(*))')
      .eq('user_id', userId);
    if (error) throw error;
    return data as CartItem[];
  },

  async addItem(userId: string, productId: string, quantity: number) {
    // Confirm the authenticated user matches to satisfy RLS (auth.uid() = user_id)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Usuário não autenticado.');
    const uid = user.id;

    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', uid)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('cart_items')
        .update({
          quantity: Number(existing.quantity) + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*, product:products(*)')
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('cart_items')
        .insert({
          user_id: uid,
          product_id: productId,
          quantity,
        })
        .select('*, product:products(*)')
        .single();
      if (error) throw error;
      return data;
    }
  },

  async updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      return cartService.removeItem(itemId);
    }
    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeItem(itemId: string) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  },

  async clearCart(userId: string) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },
};
