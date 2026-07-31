import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl,
  Modal, TextInput, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { CheckCircle, Store, Truck, MapPin } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { createRealtimeTopic, removeRealtimeChannel } from '@/lib/realtime';
import { useAuth } from '@/hooks/useAuth';
import { ordersService } from '@/services/orders';
import { operatorsService } from '@/services/operators';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const CONTACT_REASONS = [
  'Pedido pronto para retirada',
  'Produto indisponível',
  'Solicitar substituição',
  'Atualizar previsão',
  'Problema com o endereço',
  'Outro',
];

export default function OperatorReadyScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [contactModal, setContactModal] = useState<{
    orderId: string; orderNumber: number; phone: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, address:addresses(*), profile:user_profiles(full_name, phone), items:order_items(*, product:products(name, sold_by_weight, unit))')
      .eq('status', 'ready')
      .order('updated_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(createRealtimeTopic('op:ready'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { removeRealtimeChannel(ch); };
  }, [load]);

  const handleAction = async (orderId: string, action: 'out_for_delivery' | 'completed', note?: string) => {
    setUpdating(orderId);
    try {
      await ordersService.updateStatus(orderId, action, note, user?.id);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setUpdating(null);
      load();
    }
  };

  const handleLogContact = async () => {
    if (!contactModal || !user || !reason) return;
    setLogging(true);
    try {
      await operatorsService.logContact(contactModal.orderId, user.id, reason, note || undefined);
      if (contactModal.phone) {
        const cleaned = contactModal.phone.replace(/\D/g, '');
        const intl = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
        const msg = encodeURIComponent(
          `Olá, somos do MarketFlow Demo. Estamos entrando em contato sobre o seu pedido nº ${contactModal.orderNumber}.`
        );
        Linking.openURL(`https://wa.me/${intl}?text=${msg}`);
      }
      setContactModal(null); setReason(''); setNote('');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLogging(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando..." />;

  return (
    <>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
      >
        <Text style={s.title}>Pedidos Prontos</Text>

        {orders.length === 0 ? (
          <View style={s.empty}>
            <CheckCircle size={52} color={Colors.success} />
            <Text style={s.emptyTitle}>Nenhum pedido pronto</Text>
            <Text style={s.emptyText}>Quando um pedido for marcado como pronto ele aparecerá aqui.</Text>
          </View>
        ) : null}

        {orders.map((order) => (
          <View key={order.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.orderNum}>Pedido #{order.order_number}</Text>
              <View style={[s.badge, order.delivery_type === 'pickup' ? s.badgePickup : s.badgeDelivery]}>
                {order.delivery_type === 'pickup' ? <Store size={12} color={Colors.primary} /> : <Truck size={12} color={Colors.info} />}
                <Text style={[s.badgeText, order.delivery_type === 'pickup' ? s.badgeTextPickup : s.badgeTextDelivery]}>
                  {order.delivery_type === 'pickup' ? 'Retirada' : 'Entrega'}
                </Text>
              </View>
            </View>

            <Text style={s.customer}>{order.profile?.full_name || 'Cliente'}</Text>

            {order.delivery_type === 'delivery' && order.address ? (
              <View style={s.addressRow}>
                <MapPin size={14} color={Colors.adminTextMuted} />
                <Text style={s.addressText}>
                  {order.address.street}, {order.address.number} — {order.address.neighborhood}
                </Text>
              </View>
            ) : null}

            {/* Items summary */}
            <View style={s.items}>
              {(order.items || []).slice(0, 3).map((item: any) => (
                <Text key={item.id} style={s.itemText}>
                  • {item.product?.name} × {Number(item.quantity).toFixed(item.product?.sold_by_weight ? 3 : 0)} {item.product?.unit}
                </Text>
              ))}
              {(order.items || []).length > 3 ? (
                <Text style={s.itemMore}>+{(order.items || []).length - 3} itens</Text>
              ) : null}
            </View>

            <Text style={s.total}>R$ {Number(order.total_amount).toFixed(2).replace('.', ',')}</Text>

            {/* Actions */}
            <View style={s.actions}>
              {order.profile?.phone ? (
                <Pressable
                  style={s.whatsappBtn}
                  onPress={() => {
                    setContactModal({ orderId: order.id, orderNumber: order.order_number, phone: order.profile.phone });
                    setReason(''); setNote('');
                  }}
                >
                  <Text style={s.whatsappBtnText}>WhatsApp</Text>
                </Pressable>
              ) : null}

              <Pressable style={s.viewBtn} onPress={() => router.push(`/operator/orders/${order.id}` as any)}>
                <Text style={s.viewBtnText}>Ver pedido</Text>
              </Pressable>

              {order.delivery_type === 'delivery' ? (
                <Pressable
                  style={[s.actionBtn, s.actionBtnPrimary]}
                  onPress={() => handleAction(order.id, 'out_for_delivery', 'Saiu para entrega')}
                  disabled={updating === order.id}
                >
                  <Text style={s.actionBtnText}>
                    {updating === order.id ? '...' : 'Saiu p/ entrega'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[s.actionBtn, s.actionBtnSuccess]}
                  onPress={() => handleAction(order.id, 'completed', 'Pedido retirado e concluído pelo cliente')}
                  disabled={updating === order.id}
                >
                  <Text style={s.actionBtnText}>
                    {updating === order.id ? '...' : 'Confirmar retirada e concluir'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Contact modal */}
      <Modal visible={!!contactModal} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView style={s.sheet} contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}>
            <Text style={s.modalTitle}>Falar com o cliente</Text>
            <Text style={s.modalSub}>Pedido #{contactModal?.orderNumber}</Text>
            {CONTACT_REASONS.map((r) => (
              <Pressable key={r} style={[s.reasonBtn, reason === r && s.reasonBtnActive]} onPress={() => setReason(r)}>
                <View style={[s.radio, reason === r && s.radioActive]} />
                <Text style={[s.reasonText, reason === r && s.reasonTextActive]}>{r}</Text>
              </Pressable>
            ))}
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
              value={note} onChangeText={setNote} multiline
              placeholder="Observação opcional..." placeholderTextColor={Colors.textMuted}
            />
            <View style={s.modalBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setContactModal(null)} />
              <Button label="Abrir WhatsApp" onPress={handleLogContact} loading={logging} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.adminText },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted, textAlign: 'center' },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  badgePickup: { backgroundColor: Colors.primarySurface },
  badgeDelivery: { backgroundColor: Colors.infoSurface },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextPickup: { color: Colors.primary },
  badgeTextDelivery: { color: Colors.info },
  customer: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.adminText },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  addressText: { flex: 1, fontSize: FontSize.sm, color: Colors.adminTextMuted },
  items: { gap: 2 },
  itemText: { fontSize: FontSize.sm, color: Colors.adminText },
  itemMore: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  total: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#25D366', borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  whatsappBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.semibold },
  viewBtn: {
    backgroundColor: Colors.adminBackground, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  viewBtnText: { fontSize: FontSize.sm, color: Colors.adminText },
  actionBtn: { borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8 },
  actionBtnPrimary: { backgroundColor: Colors.info },
  actionBtnSuccess: { backgroundColor: Colors.success },
  actionBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.bold },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 80, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  reasonBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  reasonBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.border },
  radioActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  reasonText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  reasonTextActive: { color: Colors.primary, fontWeight: FontWeight.medium },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  modalBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
});
