import { useState, useEffect, useCallback } from 'react';
import { Order } from '@/types/database';
import { ordersService } from '@/services/orders';
import { removeRealtimeChannel } from '@/lib/realtime';
import { useAuth } from './useAuth';

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const data = await ordersService.getByUser(user.id);
      setOrders(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar pedidos');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: update order list when any of user's orders change
  useEffect(() => {
    if (!user) return;
    const channel = ordersService.subscribeToAllOrders(() => load());
    return () => { removeRealtimeChannel(channel); };
  }, [user, load]);

  return { orders, isLoading, error, refresh: load };
}

export function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderId) return;
    const data = await ordersService.getById(orderId);
    setOrder(data);
    setIsLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!orderId) return;
    const channel = ordersService.subscribeToOrder(orderId, (updated) => {
      setOrder((prev) => prev ? { ...prev, ...updated } : null);
    });
    return () => { removeRealtimeChannel(channel); };
  }, [orderId]);

  return { order, isLoading, setOrder, reload: load };
}
