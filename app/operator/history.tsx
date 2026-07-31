import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { History } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

export default function OperatorHistoryScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, profile:user_profiles(full_name)')
      .in('status', ['completed', 'cancelled', 'refused', 'delivered'])
      .order('updated_at', { ascending: false })
      .limit(50);
    setOrders(data || []);
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner fullScreen message="Carregando histórico..." />;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}>
      <Text style={s.title}>Histórico Operacional</Text>
      {orders.length === 0 ? (
        <View style={s.empty}>
          <History size={48} color={Colors.adminTextMuted} />
          <Text style={s.emptyText}>Nenhum pedido finalizado.</Text>
        </View>
      ) : null}
      {orders.map((order) => (
        <View key={order.id} style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.orderNum}>Pedido #{order.order_number}</Text>
            <View style={[s.badge, order.status === 'completed' || order.status === 'delivered' ? s.badgeDone : s.badgeFailed]}>
              <Text style={[s.badgeText, order.status === 'completed' || order.status === 'delivered' ? s.badgeTextDone : s.badgeTextFailed]}>
                {order.status === 'completed' ? 'Concluído' : order.status === 'delivered' ? 'Entregue (concluído)' : order.status === 'cancelled' ? 'Cancelado' : 'Recusado'}
              </Text>
            </View>
          </View>
          <Text style={s.customer}>{order.profile?.full_name || 'Cliente'}</Text>
          <Text style={s.date}>
            {new Date(order.updated_at).toLocaleString('pt-BR')} ·
            R$ {Number(order.total_amount).toFixed(2).replace('.', ',')}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: 4,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeDone: { backgroundColor: Colors.successSurface },
  badgeFailed: { backgroundColor: Colors.errorSurface },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextDone: { color: Colors.success },
  badgeTextFailed: { color: Colors.error },
  customer: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  date: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
});
