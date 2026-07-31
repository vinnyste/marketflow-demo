import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { CheckCircle, Store, Truck, Scale, CreditCard, ReceiptText } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { createRealtimeTopic, removeRealtimeChannel } from '@/lib/realtime';
import { ordersService } from '@/services/orders';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus } from '@/types/database';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  weighing: 'Aguardando pesagem',
  weighed: 'Pesado',
  ready: 'Pronto',
  out_for_delivery: 'Saiu p/ entrega',
  delivered: 'Entregue',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  refused: 'Recusado',
};

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  confirmed: Colors.info,
  preparing: Colors.statusPreparing,
  weighing: Colors.warning,
  weighed: Colors.info,
  ready: Colors.success,
  out_for_delivery: Colors.statusOutForDelivery,
  completed: Colors.success,
  cancelled: Colors.error,
  refused: Colors.error,
};

const ACTIVE_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'weighing',
  'weighed',
  'ready',
  'out_for_delivery',
];

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  debit_card: 'Débito',
  credit_card: 'Crédito',
  food_voucher: 'Alimentação',
  cash: 'Dinheiro',
};

export default function OperatorDashboard() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingWeightId, setOpeningWeightId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, address:addresses(*), profile:user_profiles(full_name, phone), items:order_items(*, product:products(name, sold_by_weight))')
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false });
    setOrders((data || []) as Order[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(createRealtimeTopic('operator:orders'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { removeRealtimeChannel(channel); };
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

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

  if (loading) return <LoadingSpinner fullScreen message="Carregando pedidos..." />;

  const pending = orders.filter((o) => o.status === 'pending');
  const inProgress = orders.filter((o) => o.status !== 'pending');

  return (
    <ScrollView
      style={[styles.scroll, { paddingBottom: insets.bottom }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.pageTitle}>Painel Operacional</Text>

      {pending.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.alertDot} />
            <Text style={styles.sectionTitle}>Aguardando confirmação ({pending.length})</Text>
          </View>
          {pending.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => router.push(`/operator/orders/${order.id}` as any)}
              urgent
            />
          ))}
        </>
      ) : null}

      {inProgress.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Em andamento ({inProgress.length})</Text>
          {inProgress.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => router.push(`/operator/orders/${order.id}` as any)}
              onWeigh={() => openWeighing(order)}
              openingWeight={openingWeightId === order.id}
            />
          ))}
        </>
      ) : null}

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <CheckCircle size={60} color={Colors.success} />
          <Text style={styles.emptyTitle}>Tudo em dia!</Text>
          <Text style={styles.emptyText}>Nenhum pedido ativo no momento.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function OrderCard({
  order,
  onPress,
  onWeigh,
  openingWeight,
  urgent,
}: {
  order: Order;
  onPress: () => void;
  onWeigh?: () => void;
  openingWeight?: boolean;
  urgent?: boolean;
}) {
  const color = STATUS_COLORS[order.status] || Colors.adminTextMuted;
  const weightItems = order.items?.filter((item) => item.product?.sold_by_weight || item.sold_by_weight) ?? [];
  const pendingWeightItems = weightItems.filter((item) => item.actual_weight == null);
  const showQuickWeight = !!onWeigh && pendingWeightItems.length > 0 &&
    ['confirmed', 'preparing', 'weighing'].includes(order.status);

  return (
    <Pressable style={[styles.card, urgent && styles.cardUrgent]} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNum}>Pedido #{order.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[order.status] || order.status}</Text>
        </View>
      </View>
      <Text style={styles.customerName}>{(order as any).profile?.full_name || 'Cliente'}</Text>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          {order.delivery_type === 'pickup'
            ? <Store size={14} color={Colors.adminTextMuted} />
            : <Truck size={14} color={Colors.adminTextMuted} />}
          <Text style={styles.metaText}>{order.delivery_type === 'pickup' ? 'Retirada' : 'Entrega'}</Text>
        </View>
        {weightItems.length > 0 ? (
          <View style={styles.metaItem}>
            <Scale size={14} color={Colors.warning} />
            <Text style={[styles.metaText, { color: Colors.warning }]}>Tem itens por peso</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <CreditCard size={14} color={Colors.adminTextMuted} />
          <Text style={styles.metaText}>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</Text>
        </View>
        {order.wants_cpf_on_invoice ? (
          <View style={styles.metaItem}>
            <ReceiptText size={14} color={Colors.primary} />
            <Text style={[styles.metaText, { color: Colors.primary, fontWeight: FontWeight.bold }]}>CPF na nota</Text>
          </View>
        ) : null}
        <Text style={styles.metaTime}>
          {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={styles.total}>R$ {Number(order.total_amount).toFixed(2).replace('.', ',')}</Text>

      {showQuickWeight ? (
        <Pressable
          style={styles.quickWeightButton}
          onPress={(event) => {
            event.stopPropagation?.();
            onWeigh?.();
          }}
          disabled={openingWeight}
        >
          <Scale size={24} color="#111" />
          <View style={{ flex: 1 }}>
            <Text style={styles.quickWeightTitle}>
              {openingWeight ? 'ABRINDO PESAGEM...' : 'PESAR AGORA'}
            </Text>
            <Text style={styles.quickWeightSubtitle}>
              {pendingWeightItems.length} item(ns) aguardando peso
            </Text>
          </View>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.warning },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: 8,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardUrgent: { borderColor: Colors.warning, backgroundColor: Colors.warningSurface + '22' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  customerName: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  metaTime: { fontSize: FontSize.xs, color: Colors.adminTextMuted, marginLeft: 'auto' as any },
  total: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  quickWeightButton: {
    minHeight: 72, marginTop: 4,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  quickWeightTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#111' },
  quickWeightSubtitle: { fontSize: FontSize.sm, color: '#2A2417', marginTop: 2 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 80 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.adminText },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
});
