import { supabase } from '@/lib/supabase';
import { createRealtimeTopic } from '@/lib/realtime';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyReward,
  LoyaltyRedemption,
} from '@/types/database';

export const loyaltyService = {
  // ─── Customer ───────────────────────────────────────────────────────────────

  async getAccount(customerId: string): Promise<LoyaltyAccount | null> {
    const { data, error } = await supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .single();
    if (error) return null;
    return data as LoyaltyAccount;
  },

  async getTransactions(customerId: string): Promise<LoyaltyTransaction[]> {
    const { data, error } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as LoyaltyTransaction[];
  },

  async getRedemptions(customerId: string): Promise<LoyaltyRedemption[]> {
    const { data, error } = await supabase
      .from('loyalty_redemptions')
      .select('*, reward:loyalty_rewards(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as LoyaltyRedemption[];
  },

  // ─── Rewards (public) ───────────────────────────────────────────────────────

  async getActiveRewards(): Promise<LoyaltyReward[]> {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .select('*, reward_product:products(id, name, price, image_url)')
      .eq('active', true)
      .order('points_required');
    if (error) throw error;
    return data as LoyaltyReward[];
  },

  async redeemReward(customerId: string, rewardId: string): Promise<{
    coupon_code: string;
    reward_name: string;
    expires_at: string;
    redemption_id: string;
  }> {
    const { data, error } = await supabase.rpc('redeem_loyalty_reward', {
      p_customer_id: customerId,
      p_reward_id: rewardId,
    });
    if (error) throw error;
    return data;
  },

  // ─── Points awarding ────────────────────────────────────────────────────────

  async awardPoints(
    orderId: string,
    customerId: string,
    orderTotal: number
  ): Promise<number> {
    const { data: settings } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', [
        'loyalty_enabled',
        'loyalty_mode',
        'loyalty_brl_per_point',
        'loyalty_min_order_value',
        'loyalty_points_per_order',
      ]);

    const sm: Record<string, string> = {};
    (settings || []).forEach((s: any) => { sm[s.key] = s.value; });

    if (sm['loyalty_enabled'] !== 'true') return 0;

    const mode = sm['loyalty_mode'] || 'per_value';
    const brlPerPoint = parseInt(sm['loyalty_brl_per_point'] || '1', 10);
    const minOrder = parseFloat(sm['loyalty_min_order_value'] || '0');
    const pointsPerOrder = parseInt(sm['loyalty_points_per_order'] || '10', 10);

    const { data, error } = await supabase.rpc('award_loyalty_points', {
      p_order_id: orderId,
      p_customer_id: customerId,
      p_order_total: orderTotal,
      p_brl_per_point: brlPerPoint,
      p_min_order: minOrder,
      p_mode: mode,
      p_points_per_order: pointsPerOrder,
    });
    if (error) throw error;
    return data as number;
  },

  // ─── Admin: manual adjustment ───────────────────────────────────────────────

  async adjustPoints(
    customerId: string,
    points: number,
    description: string
  ): Promise<void> {
    const { error } = await supabase.rpc('adjust_loyalty_points', {
      p_customer_id: customerId,
      p_points: points,
      p_description: description,
    });
    if (error) throw error;
  },

  // ─── Admin: all accounts ────────────────────────────────────────────────────

  async getAllAccounts(): Promise<
    (LoyaltyAccount & { profile?: { full_name: string | null; email: string | null } })[]
  > {
    const { data, error } = await supabase
      .from('loyalty_accounts')
      .select('*, profile:user_profiles(full_name, email)')
      .order('points_balance', { ascending: false });
    if (error) throw error;
    return data as any[];
  },

  // ─── Admin: rewards CRUD ────────────────────────────────────────────────────

  async getAllRewards(): Promise<LoyaltyReward[]> {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .select('*, reward_product:products(id, name, price)')
      .order('points_required');
    if (error) throw error;
    return data as LoyaltyReward[];
  },

  async createReward(
    payload: Omit<LoyaltyReward, 'id' | 'created_at' | 'updated_at' | 'reward_product'>
  ): Promise<LoyaltyReward> {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as LoyaltyReward;
  },

  async updateReward(
    id: string,
    payload: Partial<Omit<LoyaltyReward, 'id' | 'created_at' | 'reward_product'>>
  ): Promise<LoyaltyReward> {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as LoyaltyReward;
  },

  async deleteReward(id: string): Promise<void> {
    const { error } = await supabase.from('loyalty_rewards').delete().eq('id', id);
    if (error) throw error;
  },

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  subscribeToAccount(customerId: string, callback: () => void) {
    return supabase
      .channel(createRealtimeTopic(`loyalty:${customerId}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_accounts',
          filter: `customer_id=eq.${customerId}`,
        },
        callback
      )
      .subscribe();
  },
};
