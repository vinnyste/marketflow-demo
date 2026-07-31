import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Store, Truck, CreditCard, Info, XCircle, MapPin, CheckCircle } from 'lucide-react-native';
import { useOrderDetail } from '@/hooks/useOrders';
import { ordersService } from '@/services/orders';
import { removeRealtimeChannel } from '@/lib/realtime';
import { OrderStatusBadge } from '@/components/feature/OrderStatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProductImage } from '@/components/feature/ProductImage';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';
import { OrderStatus, OrderStatusHistory, OrderItem } from '@/types/database';

const STATUS_TIMELINE: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'pending', label: 'Pedido recebido', icon: 'receipt' },
  { status: 'confirmed', label: 'Pedido aceito', icon: 'check-circle' },
  { status: 'preparing', label: 'Em preparação', icon: 'restaurant' },
  { status: 'weighing', label: 'Aguardando pesagem', icon: 'scale' },
  { status: 'weighed', label: 'Pesagem concluída', icon: 'done-all' },
  { status: 'ready', label: 'Pronto', icon: 'inventory' },
  { status: 'out_for_delivery', label: 'Saiu para entrega', icon: 'local-shipping' },
  { status: 'completed', label: 'Pedido concluído', icon: 'star' },
];

const CANCELLED_STATUSES: OrderStatus[] = ['cancelled', 'refused'];

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX na entrega',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  food_voucher: 'Cartão-alimentação',
  cash: 'Dinheiro',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { order, isLoading, setOrder } = useOrderDetail(id!);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);

  const loadHistory = useCallback(async () => {
    if (id) {
      const h = await ordersService.getStatusHistory(id);
      setHistory(h as OrderStatusHistory[]);
    }
  }, [id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, order?.status]);

  // Subscribe to order item updates (weight changes)
  useEffect(() => {
    if (!id) return;
    const channel = ordersService.subscribeToOrderItems(id, async () => {
      const fresh = await ordersService.getById(id);
      if (fresh) setOrder(fresh);
      await loadHistory();
    });
    return () => { removeRealtimeChannel(channel); };
  }, [id, loadHistory, setOrder]);

  const toSafeNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
      const parsed = Number(value.trim().replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatPrice = (value: unknown) =>
    `R$ ${toSafeNumber(value).toFixed(2).replace('.', ',')}`;

  const formatWeight = (value: unknown) =>
    `${toSafeNumber(value).toFixed(3)} kg`;

  const formatDate = (value: unknown) => {
    const date = new Date(typeof value === 'string' ? value : '');
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const isCancelled = order ? CANCELLED_STATUSES.includes(order.status) : false;
  const isPickup = order?.delivery_type === 'pickup';
  const hasWeightItems = order?.items?.some((i) => i.sold_by_weight) ?? false;
  const hasPendingWeightItems = order?.items?.some((i) => i.sold_by_weight && i.actual_weight == null) ?? false;

  // Build the timeline: filter out delivery step for pickup orders
  const relevantTimeline = STATUS_TIMELINE.filter((step) => {
    if (isPickup && step.status === 'out_for_delivery') return false;
    if (!hasWeightItems && (step.status === 'weighing' || step.status === 'weighed')) return false;
    return true;
  });

  const timelineStatus = order?.status === 'delivered' ? 'completed' : order?.status;
  const currentIndex = timelineStatus
    ? relevantTimeline.findIndex((step) => step.status === timelineStatus)
    : -1;

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando pedido..." />;
  if (!order) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>Pedido não encontrado</Text>
    </View>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.orderNum}>Pedido #{order.order_number}</Text>
            <Text style={styles.date}>{formatDate(order.created_at)}</Text>
          </View>
          <OrderStatusBadge status={order.status} />
        </View>

        <View style={styles.infoRow}>
          {isPickup ? <Store size={14} color={Colors.textMuted} /> : <Truck size={14} color={Colors.textMuted} />}
          <Text style={styles.infoText}>
            {isPickup ? 'Retirada no MarketFlow Demo' : 'Entrega no endereço'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <CreditCard size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>
            {PAYMENT_LABELS[order.payment_method] || order.payment_method}
            {order.change_for ? (
              ` — Troco p/ ${formatPrice(order.change_for)}` +
              (hasWeightItems && !order.items?.every((i) => !i.sold_by_weight || i.actual_weight != null)
                ? ' (provisório)'
                : '')
            ) : ''}
          </Text>
        </View>
      </View>

      {/* Pickup notice */}
      {isPickup && order.status !== 'completed' ? (
        <View style={styles.pickupNotice}>
          <Store size={18} color={Colors.primary} />
          <Text style={styles.pickupText}>
            Aguarde o aviso de que seu pedido está pronto para retirada.
          </Text>
        </View>
      ) : null}

      {order.status === 'completed' ? (
        <View style={styles.completedNotice}>
          <CheckCircle size={20} color={Colors.success} />
          <Text style={styles.completedNoticeText}>
            {isPickup ? 'Pedido retirado e concluído com sucesso.' : 'Pedido entregue e concluído com sucesso.'}
          </Text>
        </View>
      ) : null}

      {/* Weight estimate notice */}
      {hasWeightItems && !isCancelled ? (
        <View style={[styles.weightNotice, !hasPendingWeightItems && styles.weightUpdatedNotice]}>
          {hasPendingWeightItems
            ? <Info size={16} color={Colors.warning} />
            : <CheckCircle size={16} color={Colors.success} />}
          <Text style={[styles.weightNoticeText, !hasPendingWeightItems && styles.weightUpdatedNoticeText]}>
            {hasPendingWeightItems
              ? 'Este pedido contém itens vendidos por peso. O valor final será atualizado após a pesagem.'
              : 'Pesagem concluída. O preço do pedido foi atualizado.'}
          </Text>
        </View>
      ) : null}

      {/* Status Timeline */}
      {!isCancelled ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acompanhamento</Text>
          <View style={styles.timelineCard}>
            {relevantTimeline.map((step, i) => {
              const isDone = currentIndex >= i;
              const isCurrent = currentIndex === i;
              return (
                <View key={step.status} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineDot,
                      isDone && styles.timelineDotDone,
                      isCurrent && styles.timelineDotCurrent,
                    ]}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDone ? Colors.textOnPrimary : Colors.border }} />
                    </View>
                    {i < relevantTimeline.length - 1 ? (
                      <View style={[styles.timelineConnector, isDone && styles.timelineConnectorDone]} />
                    ) : null}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineLabel, isDone && styles.timelineLabelDone, isCurrent && styles.timelineLabelCurrent]}>
                      {step.label}
                    </Text>
                    {/* Show timestamp from history */}
                    {(() => {
                      const h = history.find((hh) => hh.status === step.status);
                      return h ? <Text style={styles.timelineDate}>{formatDate(h.created_at)}</Text> : null;
                    })()}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.cancelledCard}>
          <XCircle size={24} color={Colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cancelledTitle}>
              {order.status === 'refused' ? 'Pedido recusado' : 'Pedido cancelado'}
            </Text>
            {history.filter((h) => h.status === order.status && h.note).map((h) => (
              <Text key={h.id} style={styles.cancelledNote}>{h.note}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Itens do pedido</Text>
        <View style={styles.itemsCard}>
          {order.items?.map((item) => (
            <WeightItemRow key={item.id} item={item} formatPrice={formatPrice} formatWeight={formatWeight} toSafeNumber={toSafeNumber} />
          ))}
        </View>
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal)}</Text>
          </View>
          {!isPickup ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxa de entrega</Text>
              <Text style={styles.summaryValue}>{formatPrice(order.delivery_fee)}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>
              {hasWeightItems
                ? (hasPendingWeightItems ? 'Total estimado' : 'Total atualizado')
                : 'Total'}
            </Text>
            <Text style={styles.totalValue}>{formatPrice(order.total_amount)}</Text>
          </View>
        </View>
      </View>

      {/* Address */}
      {order.address ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entrega em</Text>
          <View style={styles.addressCard}>
            <MapPin size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>{order.address.label}</Text>
              <Text style={styles.addressText}>
                {order.address.street}, {order.address.number}
                {order.address.complement ? ` — ${order.address.complement}` : ''}
              </Text>
              <Text style={styles.addressText}>
                {order.address.neighborhood} — {order.address.city}/{order.address.state}
              </Text>
              {order.address.reference ? (
                <Text style={styles.addressRef}>Ref: {order.address.reference}</Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function WeightItemRow({
  item,
  formatPrice,
  formatWeight,
  toSafeNumber,
}: {
  item: OrderItem;
  formatPrice: (value: unknown) => string;
  formatWeight: (value: unknown) => string;
  toSafeNumber: (value: unknown, fallback?: number) => number;
}) {
  const isWeighed = item.sold_by_weight && item.actual_weight != null;
  const displayTotal = item.sold_by_weight
    ? (isWeighed ? item.final_total ?? item.total_price : item.estimated_total ?? item.total_price)
    : item.total_price;

  return (
    <View style={styles.itemRow}>
      <ProductImage
        imageUrl={item.product?.image_url}
        productName={item.product?.name}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.product?.name}</Text>
        {item.sold_by_weight ? (
          <>
            <Text style={styles.itemQty}>
              Solicitado: ~{formatWeight(item.requested_weight ?? item.quantity)}
            </Text>
            {isWeighed ? (
              <Text style={[styles.itemQty, { color: Colors.success }]}>
                Pesado: {formatWeight(item.actual_weight)} ✓
              </Text>
            ) : (
              <Text style={styles.itemEstimate}>⏳ Aguardando pesagem</Text>
            )}
            <Text style={styles.itemQty}>
              {formatPrice(item.price_per_kg_snapshot ?? item.unit_price)}/kg
            </Text>
          </>
        ) : (
          <Text style={styles.itemQty}>
            {toSafeNumber(item.quantity)}× {formatPrice(item.unit_price)}
          </Text>
        )}
      </View>
      <View style={styles.itemTotalCol}>
        <Text style={styles.itemTotal}>{formatPrice(displayTotal ?? 0)}</Text>
        {item.sold_by_weight ? (
          <Text style={[styles.itemEstimateLabel, isWeighed && styles.itemUpdatedLabel]}>
            {isWeighed ? 'preço atualizado' : 'estimado'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: FontSize.lg, color: Colors.textSecondary },

  headerCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm, ...Shadow.sm,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  date: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  pickupNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.primarySurface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary,
  },
  pickupText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  completedNotice: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.successSurface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.success,
  },
  completedNoticeText: { flex: 1, fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.bold },

  weightNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.warningSurface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.warning,
  },
  weightNoticeText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  weightUpdatedNotice: { backgroundColor: Colors.successSurface, borderColor: Colors.success },
  weightUpdatedNoticeText: { color: Colors.success, fontWeight: FontWeight.bold },

  cancelledCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.errorSurface, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.error,
  },
  cancelledTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.error },
  cancelledNote: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  timelineCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, ...Shadow.sm,
  },
  timelineRow: { flexDirection: 'row', gap: Spacing.md },
  timelineLeft: { alignItems: 'center', width: 28 },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  timelineDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timelineDotCurrent: {
    backgroundColor: Colors.primary, borderColor: Colors.primaryLight,
    shadowColor: Colors.primary, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4,
  },
  timelineConnector: { width: 2, flex: 1, backgroundColor: Colors.border, minHeight: 16, marginVertical: 2 },
  timelineConnectorDone: { backgroundColor: Colors.primary },
  timelineContent: { flex: 1, paddingBottom: Spacing.md, paddingTop: 4 },
  timelineLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  timelineLabelDone: { color: Colors.textSecondary },
  timelineLabelCurrent: { color: Colors.primary, fontWeight: FontWeight.bold },
  timelineDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  itemsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm, gap: Spacing.md,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  itemImage: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.borderLight, flexShrink: 0 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary, lineHeight: 18 },
  itemQty: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  itemEstimate: { fontSize: FontSize.xs, color: Colors.warning, marginTop: 2 },
  itemTotalCol: { alignItems: 'flex-end', gap: 2 },
  itemTotal: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  itemEstimateLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  itemUpdatedLabel: { color: Colors.success, fontStyle: 'normal', fontWeight: FontWeight.bold },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm, gap: Spacing.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  totalLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border },

  addressCard: {
    flexDirection: 'row', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  addressLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  addressText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  addressRef: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
