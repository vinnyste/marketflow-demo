import { useState, useEffect, useCallback } from 'react';
import { loyaltyService } from '@/services/loyalty';
import { removeRealtimeChannel } from '@/lib/realtime';
import {
  LoyaltyAccount,
  LoyaltyTransaction,
  LoyaltyReward,
  LoyaltyRedemption,
} from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

export function useLoyalty() {
  const { user } = useAuth();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const [acc, txs, rws, reds] = await Promise.all([
        loyaltyService.getAccount(user.id),
        loyaltyService.getTransactions(user.id),
        loyaltyService.getActiveRewards(),
        loyaltyService.getRedemptions(user.id),
      ]);
      setAccount(acc);
      setTransactions(txs);
      setRewards(rws);
      setRedemptions(reds);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = loyaltyService.subscribeToAccount(user.id, () => {
      load();
    });
    return () => { removeRealtimeChannel(channel); };
  }, [user, load]);

  return { account, transactions, rewards, redemptions, isLoading, refresh: load };
}
