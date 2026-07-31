import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, TextInput, Modal, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Scale, CheckCircle, ArrowRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { createRealtimeTopic, removeRealtimeChannel } from '@/lib/realtime';
import { ordersService } from '@/services/orders';
import { useAuth } from '@/hooks/useAuth';
import { Order } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function OperatorWeighingScreen() {
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const selectedOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weightModal, setWeightModal] = useState<{
    visible: boolean; orderId: string; itemId: string;
    productName: string; pricePerKg: number; estimatedKg: number;
  } | null>(null);
  const [actualWeight, setActualWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, profile:user_profiles(full_name, phone), items:order_items(*, product:products(name, unit, price, sold_by_weight))')
      .in('status', ['preparing', 'weighing', 'weighed'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar pesagem:', error);
      setOrders([]);
    } else {
      const weightedOrders = ((data || []) as Order[]).filter((order) =>
        order.items?.some((item) => item.sold_by_weight || item.product?.sold_by_weight)
      );
      setOrders(weightedOrders);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(createRealtimeTopic('operator:weighing'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => { void load(); })
      .subscribe();
    return () => { removeRealtimeChannel(channel); };
  }, [load]);

  const visibleOrders = useMemo(() => {
    if (!selectedOrderId) return orders;
    const selected = orders.filter((order) => order.id === selectedOrderId);
    return selected.length > 0 ? selected : orders;
  }, [orders, selectedOrderId]);

  const handleWeigh = async () => {
    if (!weightModal || !user) return;
    const kg = numberValue(actualWeight, -1);
    if (kg <= 0) {
      Alert.alert('Peso inválido', 'Informe um peso válido em kg.');
      return;
    }

    setSaving(true);
    try {
      await ordersService.updateItemWeight(
        weightModal.itemId,
        kg,
        weightModal.pricePerKg,
        user.id
      );
      await ordersService.recalculateTotal(weightModal.orderId);

      const refreshed = await ordersService.getById(weightModal.orderId);
      const pendingItems = refreshed?.items?.filter(
        (item) => item.sold_by_weight && item.actual_weight == null
      ) ?? [];
      const finished = !!refreshed && pendingItems.length === 0;

      if (finished && ['confirmed', 'preparing', 'weighing'].includes(refreshed.status)) {
        await ordersService.updateStatus(
          weightModal.orderId,
          'weighed',
          'Pesagem concluída automaticamente.',
          user.id
        );
      }

      const finishedOrderId = weightModal.orderId;
      setWeightModal(null);
      setActualWeight('');
      await load();

      // Ao terminar o último item, abre diretamente o pedido para marcar como pronto.
      if (finished) {
        router.replace(`/operator/orders/${finishedOrderId}` as any);
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível salvar a pesagem.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando pesagem..." />;

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={Colors.primary}
          />
        }
      >
        <Text style={s.title}>Pesagem rápida</Text>
        <Text style={s.subtitle}>Toque no botão grande do produto e informe o peso real.</Text>

        {visibleOrders.length === 0 ? (
          <View style={s.empty}>
            <Scale size={48} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhum pedido aguardando pesagem.</Text>
          </View>
        ) : null}

        {visibleOrders.map((order) => {
          const weightItems = (order.items || []).filter(
            (item) => item.product?.sold_by_weight || item.sold_by_weight
          );
          const pendingCount = weightItems.filter((item) => item.actual_weight == null).length;

          return (
            <View key={order.id} style={s.card}>
              <View style={s.cardTop}>
                <View>
                  <Text style={s.orderNum}>Pedido #{order.order_number}</Text>
                  <Text style={s.customer}>{(order as any).profile?.full_name || 'Cliente'}</Text>
                </View>
                <View style={[s.badge, pendingCount === 0 && s.badgeDone]}>
                  {pendingCount === 0
                    ? <CheckCircle size={16} color={Colors.success} />
                    : <Scale size={16} color={Colors.warning} />}
                  <Text style={[s.badgeText, pendingCount === 0 && s.badgeTextDone]}>
                    {pendingCount === 0 ? 'Pesagem concluída' : `${pendingCount} pendente(s)`}
                  </Text>
                </View>
              </View>

              {weightItems.map((item) => {
                const requestedKg = numberValue(item.requested_weight ?? item.quantity);
                const actualKg = item.actual_weight == null ? null : numberValue(item.actual_weight);
                return (
                  <View key={item.id} style={s.weightItem}>
                    <Text style={s.itemName}>{item.product?.name || 'Produto'}</Text>
                    <Text style={s.itemDetail}>
                      Solicitado: ~{requestedKg.toFixed(3)} kg
                      {actualKg != null ? ` · Pesado: ${actualKg.toFixed(3)} kg` : ''}
                    </Text>

                    {actualKg == null ? (
                      <Pressable
                        style={s.weighBtn}
                        onPress={() => {
                          setWeightModal({
                            visible: true,
                            orderId: order.id,
                            itemId: item.id,
                            productName: item.product?.name || 'Produto',
                            pricePerKg: numberValue(item.price_per_kg_snapshot ?? item.unit_price ?? item.product?.price),
                            estimatedKg: requestedKg,
                          });
                          setActualWeight('');
                        }}
                      >
                        <Scale size={24} color="#111" />
                        <Text style={s.weighBtnText}>INFORMAR PESO</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={s.editWeightBtn}
                        onPress={() => {
                          setWeightModal({
                            visible: true,
                            orderId: order.id,
                            itemId: item.id,
                            productName: item.product?.name || 'Produto',
                            pricePerKg: numberValue(item.price_per_kg_snapshot ?? item.unit_price ?? item.product?.price),
                            estimatedKg: requestedKg,
                          });
                          setActualWeight(String(actualKg));
                        }}
                      >
                        <CheckCircle size={20} color={Colors.success} />
                        <Text style={s.editWeightText}>ALTERAR PESO — {actualKg.toFixed(3)} kg</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}

              {pendingCount === 0 ? (
                <Pressable
                  style={s.continueBtn}
                  onPress={() => router.push(`/operator/orders/${order.id}` as any)}
                >
                  <Text style={s.continueBtnText}>ABRIR PEDIDO E MARCAR COMO PRONTO</Text>
                  <ArrowRight size={20} color="#111" />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!weightModal?.visible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Informar peso</Text>
            <Text style={s.modalProduct}>{weightModal?.productName}</Text>
            <Text style={s.modalSub}>
              Solicitado: {numberValue(weightModal?.estimatedKg).toFixed(3)} kg
            </Text>
            <Text style={s.modalSub}>
              Preço: R$ {numberValue(weightModal?.pricePerKg).toFixed(2).replace('.', ',')}/kg
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>Peso real em kg</Text>
              <TextInput
                style={s.input}
                value={actualWeight}
                onChangeText={setActualWeight}
                keyboardType="decimal-pad"
                placeholder="Ex: 0,850"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            {actualWeight && numberValue(actualWeight, -1) > 0 ? (
              <View style={s.previewRow}>
                <Text style={s.previewLabel}>Total final:</Text>
                <Text style={s.previewValue}>
                  R$ {(numberValue(actualWeight) * numberValue(weightModal?.pricePerKg))
                    .toFixed(2).replace('.', ',')}
                </Text>
              </View>
            ) : null}

            <View style={s.formBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setWeightModal(null)} />
              <Button label="CONFIRMAR PESO" onPress={handleWeigh} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  subtitle: { fontSize: FontSize.sm, color: Colors.adminTextMuted, marginTop: -6 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  orderNum: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.adminText },
  customer: { fontSize: FontSize.sm, color: Colors.adminTextMuted, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warningSurface, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeDone: { backgroundColor: Colors.successSurface },
  badgeText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  badgeTextDone: { color: Colors.success },
  weightItem: {
    gap: 8, backgroundColor: Colors.adminBackground,
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  itemName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  itemDetail: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  weighBtn: {
    width: '100%', minHeight: 62,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  weighBtnText: { fontSize: FontSize.lg, color: '#111', fontWeight: FontWeight.bold },
  editWeightBtn: {
    width: '100%', minHeight: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.successSurface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.success,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  editWeightText: { fontSize: FontSize.md, color: Colors.success, fontWeight: FontWeight.bold },
  continueBtn: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  continueBtnText: { fontSize: FontSize.md, color: '#111', fontWeight: FontWeight.bold },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.adminSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.adminText },
  modalProduct: { fontSize: FontSize.lg, color: Colors.adminText, fontWeight: FontWeight.semibold },
  modalSub: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  input: {
    height: 64, borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.xxl, color: Colors.adminText,
    backgroundColor: Colors.adminBackground, textAlign: 'center',
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  previewValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end' },
});
