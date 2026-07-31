import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Store, Truck, CreditCard, Scale } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrders } from '@/hooks/useOrders';
import { OrderStatusBadge } from '@/components/feature/OrderStatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';
import { Order } from '@/types/database';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  debit_card: 'Débito',
  credit_card: 'Crédito',
  food_voucher: 'Alimentação',
  cash: 'Dinheiro',
};

function OrderCard({ order }: { order: Order }) {
  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const isPickup = order.delivery_type === 'pickup';
  const hasWeightItems = order.items?.some((i) => i.sold_by_weight) ?? false;
  const hasPendingWeightItems = order.items?.some((i) => i.sold_by_weight && i.actual_weight == null) ?? false;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
      onPress={() => router.push(`/orders/${order.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderNum}>Pedido #{order.order_number}</Text>
        <OrderStatusBadge status={order.status} size="sm" />
      </View>
      <Text style={styles.date}>{formatDate(order.created_at)}</Text>

      <View style={styles.tagRow}>
        <View style={styles.tag}>
          {isPickup ? <Store size={12} color={Colors.textMuted} /> : <Truck size={12} color={Colors.textMuted} />}
          <Text style={styles.tagText}>{isPickup ? 'Retirada' : 'Entrega'}</Text>
        </View>
        <View style={styles.tag}>
          <CreditCard size={12} color={Colors.textMuted} />
          <Text style={styles.tagText}>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</Text>
        </View>
        {hasWeightItems ? (
          <View style={styles.tag}>
            <Scale size={12} color={Colors.warning} />
            <Text style={[styles.tagText, { color: Colors.warning }]}>Por peso</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.itemCount}>{order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'itens'}</Text>
        <View style={styles.totalGroup}>
          {hasWeightItems ? (
            <Text style={[styles.estimateLabel, !hasPendingWeightItems && styles.updatedLabel]}>
              {hasPendingWeightItems ? 'estimado' : 'preço atualizado'}
            </Text>
          ) : null}
          <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { orders, isLoading, refresh } = useOrders();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Pedidos</Text>
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Carregando pedidos..." />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Nenhum pedido ainda"
          subtitle="Faça seu primeiro pedido!"
          imageSource={require('@/assets/images/empty-orders.png')}
          actionLabel="Explorar produtos"
          onAction={() => router.push('/(tabs)')}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={isLoading}
          renderItem={({ item }) => <OrderCard order={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  date: { fontSize: FontSize.xs, color: Colors.textMuted },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  itemCount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  estimateLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  updatedLabel: { color: Colors.success, fontStyle: 'normal', fontWeight: FontWeight.bold },
  total: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
});
