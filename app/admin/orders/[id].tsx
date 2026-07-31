import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, Alert,
} from 'react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import {
  User, Package, Truck, CreditCard, Scale, CheckCircle,
  XCircle, MapPin, Info, ReceiptText, Banknote,
} from 'lucide-react-native';
import { ordersService } from '@/services/orders';
import { removeRealtimeChannel } from '@/lib/realtime';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus, OrderItem } from '@/types/database';
import { OrderStatusBadge } from '@/components/feature/OrderStatusBadge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

type FlowStep = {
  status: OrderStatus;
  label: string;
};

const DELIVERY_FLOW: FlowStep[] = [
  { status: 'preparing',        label: 'Aceitar e iniciar preparação' },
  { status: 'ready',            label: 'Marcar como pronto' },
  { status: 'out_for_delivery', label: 'Saiu para entrega' },
  { status: 'completed',        label: 'Confirmar entrega e concluir' },
];

const PICKUP_FLOW: FlowStep[] = [
  { status: 'preparing', label: 'Aceitar e iniciar preparação' },
  { status: 'ready',     label: 'Marcar como pronto' },
  { status: 'completed', label: 'Confirmar retirada e concluir' },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  weighing: 'Aguard. pesagem',
  weighed: 'Pesado',
  ready: 'Pronto',
  out_for_delivery: 'A caminho',
  delivered: 'Entregue',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  refused: 'Recusado',
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX na entrega',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  food_voucher: 'Cartão-alimentação',
  cash: 'Dinheiro',
};

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'refused'];
const WEIGHT_EDITABLE_STATUSES: OrderStatus[] = ['confirmed', 'preparing', 'weighing', 'weighed'];

export default function AdminOrderDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const pathname = usePathname();
  const isOperatorView = pathname.startsWith('/operator');
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [weightModal, setWeightModal] = useState<OrderItem | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelNote, setCancelNote] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setLoadError('Identificador do pedido não informado.');
      setIsLoading(false);
      return;
    }

    setLoadError(null);
    try {
      const data = await ordersService.getById(orderId);
      setOrder(data);
      if (!data) setLoadError('Pedido não encontrado ou sem permissão de acesso.');
    } catch (error: any) {
      console.error('Erro ao carregar pedido:', error);
      setOrder(null);
      setLoadError(error?.message || 'Não foi possível carregar o pedido.');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    if (!orderId) return;

    const orderChannel = ordersService.subscribeToOrder(orderId, (updated) => {
      setOrder((prev) => prev ? { ...prev, ...updated } : null);
    });
    const itemsChannel = ordersService.subscribeToOrderItems(orderId, () => { void load(); });

    return () => {
      removeRealtimeChannel(orderChannel);
      removeRealtimeChannel(itemsChannel);
    };
  }, [orderId, load]);

  const getFlow = () => {
    if (!order) return [];
    return order.delivery_type === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW;
  };

  const getNextStep = (): FlowStep | null => {
    if (!order) return null;
    const flow = getFlow();
    const hasWeight = order.items?.some((i) => i.sold_by_weight) ?? false;
    const allWeightItemsDone = order.items
      ?.filter((i) => i.sold_by_weight)
      .every((i) => i.actual_weight != null) ?? true;

    // Ao aceitar, o pedido já entra diretamente em preparação.
    if (order.status === 'pending' || order.status === 'confirmed') return flow[0] ?? null;

    // A pesagem acontece pelos botões grandes, sem passos manuais de
    // "enviar para pesagem" e "confirmar pesagem".
    if (['preparing', 'weighing'].includes(order.status)) {
      if (hasWeight && !allWeightItemsDone) return null;
      return flow.find((step) => step.status === 'ready') ?? null;
    }
    if (order.status === 'weighed') {
      return flow.find((step) => step.status === 'ready') ?? null;
    }

    // Compatibility with orders that were previously saved as "delivered".
    // They can be finalized normally instead of appearing as an error.
    if (order.status === 'delivered') {
      return flow.find((step) => step.status === 'completed') ?? null;
    }

    const currentIdx = flow.findIndex((step) => step.status === order.status);
    if (currentIdx >= 0 && currentIdx < flow.length - 1) return flow[currentIdx + 1];
    return null;
  };

  const handleAdvanceStatus = async (step: FlowStep) => {
    if (!order || !user) return;
    if (step.status === 'weighed') {
      const unweighed = order.items?.filter((i) => i.sold_by_weight && !i.actual_weight) ?? [];
      if (unweighed.length > 0) {
        Alert.alert(
          'Pesagem incompleta',
          `Ainda há ${unweighed.length} item(ns) aguardando pesagem. Pese todos antes de confirmar.`
        );
        return;
      }
    }
    setUpdating(true);
    try {
      await ordersService.updateStatus(order.id, step.status, undefined, user.id);
      if (step.status === 'weighed') {
        await ordersService.recalculateTotal(order.id);
      }
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível atualizar o status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRefuse = async () => {
    if (!order || !user) return;
    setUpdating(true);
    try {
      await ordersService.updateStatus(order.id, 'refused', 'Pedido recusado pelo estabelecimento.', user.id);
      await load();
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!order || !user || !cancelNote.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo do cancelamento.');
      return;
    }
    setUpdating(true);
    try {
      await ordersService.updateStatus(order.id, 'cancelled', cancelNote.trim(), user.id);
      setCancelModal(false);
      setCancelNote('');
      await load();
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveWeight = async () => {
    if (!weightModal || !order || !user) return;
    if (!WEIGHT_EDITABLE_STATUSES.includes(order.status)) {
      setWeightModal(null);
      setWeightInput('');
      Alert.alert(
        'Pedido encerrado',
        'O peso só pode ser alterado durante a preparação ou pesagem do pedido.'
      );
      return;
    }
    const kg = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(kg) || kg <= 0) {
      Alert.alert('Peso inválido', 'Informe um peso válido em kg.');
      return;
    }
    setSavingWeight(true);
    try {
      const pricePerKg = weightModal.price_per_kg_snapshot ?? weightModal.unit_price;
      await ordersService.updateItemWeight(weightModal.id, kg, pricePerKg, user.id);
      await ordersService.recalculateTotal(order.id);

      // Quando o último item for pesado, a pesagem é confirmada automaticamente.
      const refreshed = await ordersService.getById(order.id);
      const pendingWeightItems = refreshed?.items?.filter(
        (item) => item.sold_by_weight && item.actual_weight == null
      ) ?? [];
      if (
        refreshed &&
        pendingWeightItems.length === 0 &&
        ['confirmed', 'preparing', 'weighing'].includes(refreshed.status)
      ) {
        await ordersService.updateStatus(
          order.id,
          'weighed',
          'Pesagem concluída automaticamente.',
          user.id
        );
      }

      setWeightModal(null);
      setWeightInput('');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar a pesagem.');
    } finally {
      setSavingWeight(false);
    }
  };

  const handleOpenWeighing = async () => {
    if (!order || !user) return;
    setUpdating(true);
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
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível abrir a pesagem.');
    } finally {
      setUpdating(false);
    }
  };

  const toSafeNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
      const normalized = value.trim().replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatPrice = (value: unknown) =>
    `R$ ${toSafeNumber(value).toFixed(2).replace('.', ',')}`;

  const formatWeight = (value: unknown) =>
    `${toSafeNumber(value).toFixed(3)} kg`;

  const formatCpf = (value: string | null | undefined) => {
    const digits = (value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return value || 'Não informado';
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatDate = (value: unknown) => {
    const date = new Date(typeof value === 'string' ? value : '');
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const nextStep = getNextStep();
  const isTerminal = order ? TERMINAL_STATUSES.includes(order.status) : false;
  const canCancel = order && !['cancelled', 'refused', 'completed', 'delivered'].includes(order.status);
  const canRefuse = order?.status === 'pending';
  const isPickup = order?.delivery_type === 'pickup';
  const weightItems = order?.items?.filter((i) => i.sold_by_weight) ?? [];
  const pendingWeightItems = weightItems.filter((i) => i.actual_weight == null);
  const allWeighted = pendingWeightItems.length === 0;
  const canEditWeight = order ? WEIGHT_EDITABLE_STATUSES.includes(order.status) : false;
  const needsWeight = weightItems.length > 0 && !allWeighted &&
    ['confirmed', 'preparing', 'weighing'].includes(order?.status || 'pending');
  const changeForValue = toSafeNumber(order?.change_for, 0);
  const currentTotal = toSafeNumber(order?.total_amount, 0);
  const calculatedChange = Math.max(changeForValue - currentTotal, 0);

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando pedido..." />;
  if (!order) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>{loadError || 'Pedido não encontrado'}</Text>
      <Pressable style={styles.retryButton} onPress={() => { setIsLoading(true); void load(); }}>
        <Text style={styles.retryButtonText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.orderNum}>Pedido #{order.order_number}</Text>
              <Text style={styles.date}>{formatDate(order.created_at)}</Text>
            </View>
            <OrderStatusBadge status={order.status} />
          </View>
          <View style={styles.customerRow}>
            <User size={16} color={Colors.adminTextMuted} />
            <Text style={styles.customerName}>{order.profile?.full_name || 'Cliente'}</Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaTag}>
              {isPickup
                ? <Package size={13} color={Colors.adminTextMuted} />
                : <Truck size={13} color={Colors.adminTextMuted} />
              }
              <Text style={styles.metaTagText}>{isPickup ? 'Retirada' : 'Entrega'}</Text>
            </View>
            <View style={styles.metaTag}>
              <CreditCard size={13} color={Colors.adminTextMuted} />
              <Text style={styles.metaTagText}>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</Text>
            </View>
          </View>
          <View style={styles.paymentInfoBox}>
            <View style={styles.paymentInfoHeader}>
              {order.payment_method === 'cash'
                ? <Banknote size={18} color={Colors.primary} />
                : <CreditCard size={18} color={Colors.primary} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentInfoLabel}>Forma de pagamento</Text>
                <Text style={styles.paymentInfoValue}>
                  {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                </Text>
              </View>
            </View>
            {order.payment_method === 'cash' ? (
              changeForValue > 0 ? (
                <View style={styles.changeDetails}>
                  <Text style={styles.changeNote}>Cliente pagará com: {formatPrice(changeForValue)}</Text>
                  <Text style={styles.changeAmount}>Troco atual: {formatPrice(calculatedChange)}</Text>
                </View>
              ) : (
                <Text style={styles.noChangeText}>Cliente informou que não precisa de troco.</Text>
              )
            ) : (
              <Text style={styles.paymentDeliveryText}>
                Cobrar na {isPickup ? 'retirada' : 'entrega'}.
              </Text>
            )}
          </View>

          {order.wants_cpf_on_invoice ? (
            <View style={styles.cpfBox}>
              <ReceiptText size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cpfLabel}>CPF NA NOTA</Text>
                <Text style={styles.cpfValue}>{formatCpf(order.invoice_cpf)}</Text>
              </View>
            </View>
          ) : null}

          {order.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Obs. do cliente:</Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Status Actions */}
        {!isTerminal ? (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Atualizar status</Text>
            <View style={styles.actionButtons}>
              {nextStep ? (
                <Button
                  label={nextStep.label}
                  onPress={() => handleAdvanceStatus(nextStep)}
                  loading={updating}
                  fullWidth
                />
              ) : null}
              {isOperatorView && needsWeight ? (
                <Pressable
                  style={styles.quickWeightButton}
                  onPress={handleOpenWeighing}
                  disabled={updating}
                >
                  <Scale size={24} color="#111" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickWeightTitle}>IR PARA PESAGEM</Text>
                    <Text style={styles.quickWeightSubtitle}>
                      {pendingWeightItems.length} item(ns) aguardando peso
                    </Text>
                  </View>
                </Pressable>
              ) : null}
              {canRefuse ? (
                <Button
                  label="Recusar pedido"
                  onPress={handleRefuse}
                  variant="outline"
                  fullWidth
                  loading={updating}
                />
              ) : null}
              {canCancel ? (
                <Button
                  label="Cancelar pedido"
                  onPress={() => setCancelModal(true)}
                  variant="danger"
                  fullWidth
                />
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.actionsCard}>
            {order.status === 'completed' || order.status === 'delivered' ? (
              <View style={styles.completedBox}>
                <CheckCircle size={20} color={Colors.success} />
                <Text style={styles.completedText}>
                  {order.status === 'completed' ? 'Pedido concluído' : 'Pedido entregue'}
                </Text>
              </View>
            ) : (
              <View style={styles.completedBox}>
                <XCircle size={20} color={Colors.error} />
                <Text style={[styles.completedText, { color: Colors.error }]}>
                  {STATUS_LABELS[order.status]}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens do pedido</Text>
          {order.items?.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.product?.name || 'Produto'}</Text>
                <Text style={styles.itemTotal}>
                  {formatPrice(
                    item.sold_by_weight
                      ? (item.final_total ?? item.estimated_total ?? item.total_price)
                      : item.total_price
                  )}
                  {item.sold_by_weight && !item.actual_weight ? ' *' : ''}
                </Text>
              </View>
              <View style={styles.itemDetails}>
                {item.sold_by_weight ? (
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.itemMeta}>
                      Solicitado: ~{formatWeight(item.requested_weight ?? item.quantity)}
                      {' · '}{formatPrice(item.price_per_kg_snapshot ?? item.unit_price)}/kg
                    </Text>
                    {item.actual_weight ? (
                      <>
                        <Text style={[styles.itemMeta, { color: Colors.success }]}>
                          {'\u2713'} Pesado: {formatWeight(item.actual_weight)}
                          {' = '}{formatPrice(item.final_total ?? 0)}
                        </Text>
                        <Text style={[styles.itemMeta, { color: Colors.success, fontWeight: FontWeight.bold }]}>
                          Preço atualizado
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.itemMeta, { color: Colors.warning }]}>Aguardando pesagem</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.itemMeta}>
                    {toSafeNumber(item.quantity)}x {formatPrice(item.unit_price)}
                  </Text>
                )}
                {item.sold_by_weight && canEditWeight ? (
                  <Pressable
                    style={[styles.weightBtn, item.actual_weight ? styles.weightBtnDone : null]}
                    onPress={() => {
                      setWeightModal(item);
                      setWeightInput(item.actual_weight ? String(item.actual_weight) : '');
                    }}
                  >
                    <Scale
                      size={14}
                      color={item.actual_weight ? Colors.success : Colors.warning}
                    />
                    <Text style={[styles.weightBtnText, item.actual_weight ? styles.weightBtnTextDone : null]}>
                      {item.actual_weight
                        ? `ALTERAR PESO — ${formatWeight(item.actual_weight)}`
                        : 'INFORMAR PESO'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}

          {order.items?.some((i) => i.sold_by_weight) ? (
            <View style={[styles.weightPendingNotice, allWeighted && styles.weightUpdatedNotice]}>
              {allWeighted
                ? <CheckCircle size={14} color={Colors.success} />
                : <Info size={14} color={Colors.warning} />}
              <Text style={[styles.weightPendingText, allWeighted && styles.weightUpdatedText]}>
                {allWeighted
                  ? 'Pesagem concluída. Preço do pedido atualizado.'
                  : '* Pese todos os itens antes de concluir o pedido.'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Summary */}
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
            <Text style={styles.totalLabel}>{weightItems.length > 0 ? (allWeighted ? 'Total atualizado' : 'Total estimado') : 'Total'}</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total_amount)}</Text>
          </View>
        </View>

        {/* Address */}
        {order.address && !isPickup ? (
          <View style={styles.addressCard}>
            <MapPin size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>
                {order.address.label} — {order.address.recipient_name}
              </Text>
              <Text style={styles.addressText}>
                {order.address.street}, {order.address.number}
                {order.address.complement ? ` — ${order.address.complement}` : ''}
              </Text>
              <Text style={styles.addressText}>
                {order.address.neighborhood} — {order.address.city}/{order.address.state}
              </Text>
              <Text style={styles.addressText}>CEP {order.address.zip_code}</Text>
              {order.address.reference ? (
                <Text style={styles.addressRef}>Ref: {order.address.reference}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Weight Modal */}
      <Modal visible={!!weightModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Registrar peso</Text>
            <Text style={styles.modalProduct}>{weightModal?.product?.name}</Text>
            <Text style={styles.modalSub}>
              Solicitado: ~{formatWeight(weightModal?.requested_weight ?? weightModal?.quantity ?? 0)}
            </Text>
            <Text style={styles.modalSub}>
              Preço: {formatPrice(weightModal?.price_per_kg_snapshot ?? weightModal?.unit_price ?? 0)}/kg
            </Text>
            <TextInput
              style={styles.weightInput}
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder="Ex: 0.350"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.weightPreview}>
              Total:{' '}
              {weightInput
                ? formatPrice(
                    toSafeNumber(weightInput) *
                    toSafeNumber(weightModal?.price_per_kg_snapshot ?? weightModal?.unit_price ?? 0)
                  )
                : '—'}
            </Text>
            <View style={styles.modalButtons}>
              <Button label="Cancelar" onPress={() => setWeightModal(null)} variant="outline" />
              <Button label="Salvar" onPress={handleSaveWeight} loading={savingWeight} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Modal */}
      <Modal visible={cancelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cancelar pedido</Text>
            <Text style={styles.modalSub}>Informe o motivo do cancelamento:</Text>
            <TextInput
              style={[styles.weightInput, { height: 80, textAlignVertical: 'top' as any, textAlign: 'left' as any, paddingTop: 10 }]}
              value={cancelNote}
              onChangeText={setCancelNote}
              placeholder="Ex: Produto indisponível"
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Button label="Voltar" onPress={() => { setCancelModal(false); setCancelNote(''); }} variant="outline" />
              <Button label="Confirmar" onPress={handleCancel} loading={updating} variant="danger" />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: FontSize.lg, color: Colors.adminTextMuted, textAlign: 'center' },
  retryButton: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.primary },
  retryButtonText: { color: '#111', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  headerCard: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.adminText },
  date: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: FontSize.md, color: Colors.adminText },
  metaRow: { flexDirection: 'row', gap: 8 },
  metaTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.adminBackground, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  metaTagText: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  paymentInfoBox: {
    backgroundColor: Colors.adminBackground, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
    padding: Spacing.md, gap: 8,
  },
  paymentInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentInfoLabel: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  paymentInfoValue: { fontSize: FontSize.md, color: Colors.adminText, fontWeight: FontWeight.bold },
  changeDetails: { gap: 3, paddingTop: 2 },
  changeNote: { fontSize: FontSize.sm, color: Colors.adminText, fontWeight: FontWeight.medium },
  changeAmount: { fontSize: FontSize.md, color: Colors.success, fontWeight: FontWeight.bold },
  noChangeText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.medium },
  paymentDeliveryText: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  cpfBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primary + '18', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary,
    padding: Spacing.md,
  },
  cpfLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold, letterSpacing: 0.6 },
  cpfValue: { fontSize: FontSize.lg, color: Colors.adminText, fontWeight: FontWeight.bold, marginTop: 2 },
  notesBox: {
    backgroundColor: Colors.warningSurface, borderRadius: Radius.sm,
    padding: Spacing.sm, gap: 2,
  },
  notesLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.warning },
  notesText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  actionsCard: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  actionButtons: { gap: Spacing.sm },
  quickWeightButton: {
    minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  quickWeightTitle: { fontSize: FontSize.lg, color: '#111', fontWeight: FontWeight.bold },
  quickWeightSubtitle: { fontSize: FontSize.sm, color: '#2A2417', marginTop: 2 },
  completedBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  completedText: { fontSize: FontSize.md, color: Colors.success, fontWeight: FontWeight.medium },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.adminText },
  itemCard: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.md,
    padding: Spacing.md, gap: 6, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.adminText },
  itemTotal: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  itemDetails: { gap: Spacing.sm },
  itemMeta: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  weightPendingNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.warningSurface, borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  weightPendingText: { flex: 1, fontSize: FontSize.xs, color: Colors.warning },
  weightUpdatedNotice: { borderColor: Colors.success, backgroundColor: Colors.successSurface },
  weightUpdatedText: { color: Colors.success, fontWeight: FontWeight.bold },
  weightBtn: {
    width: '100%', minHeight: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  weightBtnDone: { backgroundColor: Colors.successSurface, borderWidth: 1, borderColor: Colors.success },
  weightBtnText: { fontSize: FontSize.md, color: '#111', fontWeight: FontWeight.bold },
  weightBtnTextDone: { color: Colors.success },
  summaryCard: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.adminBorder, gap: Spacing.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  summaryValue: { fontSize: FontSize.md, color: Colors.adminText, fontWeight: FontWeight.medium },
  totalLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.adminText },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.adminBorder },
  addressCard: {
    flexDirection: 'row', gap: Spacing.md,
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  addressLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.adminText },
  addressText: { fontSize: FontSize.sm, color: Colors.adminTextMuted, lineHeight: 18 },
  addressRef: { fontSize: FontSize.xs, color: Colors.adminTextMuted, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.xl, gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalProduct: { fontSize: FontSize.lg, color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  weightInput: {
    height: 56, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.xl, color: Colors.textPrimary,
    textAlign: 'center' as any,
  },
  weightPreview: {
    fontSize: FontSize.md, color: Colors.primary,
    fontWeight: FontWeight.semibold, textAlign: 'center' as any,
  },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end' },
});
