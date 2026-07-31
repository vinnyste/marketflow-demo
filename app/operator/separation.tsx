import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Package, Scale, Square } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { createRealtimeTopic, removeRealtimeChannel } from '@/lib/realtime';
import { ordersService } from '@/services/orders';
import { useAuth } from '@/hooks/useAuth';
import { Order } from '@/types/database';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

export default function OperatorSeparationScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingWeightId, setOpeningWeightId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, profile:user_profiles(full_name, phone), items:order_items(*, product:products(name, sold_by_weight, unit))')
      .in('status', ['confirmed', 'preparing', 'weighing'])
      .order('created_at', { ascending: false });
    setOrders((data || []) as Order[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(createRealtimeTopic('op:sep'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load(); })
      .subscribe();
    return () => { removeRealtimeChannel(ch); };
  }, [load]);

  const openWeighing = async (order: Order) => {
    if (!user) return;
    setOpeningWeightId(order.id);
    try {
      if (['confirmed', 'preparing'].includes(order.status)) {
        await ordersService.updateStatus(
          order.id,
          'weighing',
          'Pedido encaminhado para pesagem.',
          user.id
        );
      }
      router.push(`/operator/weighing?orderId=${order.id}` as any);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível abrir a pesagem.');
    } finally {
      setOpeningWeightId(null);
    }
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando..." />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); void load(); }}
          tintColor={Colors.primary}
        />
      }
    >
      <Text style={styles.title}>Preparação</Text>
      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Package size={48} color={Colors.adminTextMuted} />
          <Text style={styles.emptyText}>Nenhum pedido em preparação.</Text>
        </View>
      ) : null}

      {orders.map((order) => {
        const weightItems = (order.items || []).filter(
          (item) => item.product?.sold_by_weight || item.sold_by_weight
        );
        const pendingWeightItems = weightItems.filter((item) => item.actual_weight == null);

        return (
          <Pressable
            key={order.id}
            style={styles.card}
            onPress={() => router.push(`/operator/orders/${order.id}` as any)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.orderNum}>Pedido #{order.order_number}</Text>
              <View style={[styles.badge, order.status === 'weighing' ? styles.badgeWeighing : styles.badgePreparing]}>
                <Text style={[styles.badgeText, order.status === 'weighing' ? styles.badgeTextWeighing : styles.badgeTextPreparing]}>
                  {order.status === 'weighing' ? 'Na pesagem' : 'Preparando'}
                </Text>
              </View>
            </View>
            <Text style={styles.customer}>{(order as any).profile?.full_name || 'Cliente'}</Text>
            <View style={styles.items}>
              {(order.items || []).map((item) => (
                <View key={item.id} style={styles.item}>
                  {item.product?.sold_by_weight
                    ? <Scale size={14} color={Colors.adminTextMuted} />
                    : <Square size={14} color={Colors.adminTextMuted} />}
                  <Text style={styles.itemText}>
                    {item.product?.name} × {Number(item.quantity).toFixed(item.product?.sold_by_weight ? 3 : 0)} {item.product?.unit}
                  </Text>
                </View>
              ))}
            </View>

            {pendingWeightItems.length > 0 ? (
              <Pressable
                style={styles.quickWeightButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  void openWeighing(order);
                }}
                disabled={openingWeightId === order.id}
              >
                <Scale size={24} color="#111" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickWeightTitle}>
                    {openingWeightId === order.id ? 'ABRINDO PESAGEM...' : 'PESAR AGORA'}
                  </Text>
                  <Text style={styles.quickWeightSubtitle}>
                    {pendingWeightItems.length} item(ns) aguardando peso
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgePreparing: { backgroundColor: Colors.warningSurface },
  badgeWeighing: { backgroundColor: Colors.infoSurface },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextPreparing: { color: Colors.warning },
  badgeTextWeighing: { color: Colors.info },
  customer: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  items: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemText: { fontSize: FontSize.sm, color: Colors.adminText },
  quickWeightButton: {
    minHeight: 72, marginTop: 4,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  quickWeightTitle: { fontSize: FontSize.lg, color: '#111', fontWeight: FontWeight.bold },
  quickWeightSubtitle: { fontSize: FontSize.sm, color: '#2A2417', marginTop: 2 },
});
