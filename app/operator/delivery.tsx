import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Linking,
  Modal, TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Truck, Store, ExternalLink } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { createRealtimeTopic, removeRealtimeChannel } from '@/lib/realtime';
import { useAuth } from '@/hooks/useAuth';
import { operatorsService } from '@/services/operators';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const CONTACT_REASONS = [
  'Produto indisponível',
  'Solicitar substituição',
  'Confirmar quantidade',
  'Confirmar peso',
  'Atualizar previsão',
  'Pedido pronto para retirada',
  'Problema com o endereço',
  'Outro',
];

export default function OperatorDeliveryScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contactModal, setContactModal] = useState<{ orderId: string; orderNumber: number; phone: string } | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, address:addresses(*), profile:user_profiles(full_name, phone), items:order_items(*, product:products(name, sold_by_weight))')
      .in('status', ['ready', 'out_for_delivery'])
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(createRealtimeTopic('op:delivery'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { removeRealtimeChannel(ch); };
  }, [load]);

  const openWhatsApp = (phone: string, orderNumber: number) => {
    const cleaned = phone.replace(/\D/g, '');
    const intl = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    const msg = encodeURIComponent(
      `Olá, somos do MarketFlow Demo. Estamos entrando em contato sobre o seu pedido nº ${orderNumber}.`
    );
    Linking.openURL(`https://wa.me/${intl}?text=${msg}`);
  };

  const handleLogContact = async () => {
    if (!contactModal || !user || !reason) return;
    setLogging(true);
    try {
      await operatorsService.logContact(contactModal.orderId, user.id, reason, note || undefined);
      if (contactModal.phone) openWhatsApp(contactModal.phone, contactModal.orderNumber);
      setContactModal(null); setReason(''); setNote('');
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setLogging(false); }
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando..." />;

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}>
        <Text style={s.title}>Entrega e Retirada</Text>
        {orders.length === 0 ? (
          <View style={s.empty}>
            <Truck size={48} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhum pedido pronto no momento.</Text>
          </View>
        ) : null}
        {orders.map((order) => (
          <View key={order.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.orderNum}>Pedido #{order.order_number}</Text>
              <View style={[s.badge, order.status === 'ready' ? s.badgeReady : s.badgeDelivery]}>
                <Text style={[s.badgeText, order.status === 'ready' ? s.badgeTextReady : s.badgeTextDelivery]}>
                  {order.status === 'ready' ? 'Pronto' : 'Saiu p/ entrega'}
                </Text>
              </View>
            </View>
            <Text style={s.customer}>{order.profile?.full_name || 'Cliente'}</Text>
            <View style={s.deliveryInfo}>
              {order.delivery_type === 'pickup' ? <Store size={14} color={Colors.adminTextMuted} /> : <Truck size={14} color={Colors.adminTextMuted} />}
              <Text style={s.deliveryText}>
                {order.delivery_type === 'pickup'
                  ? 'Retirada no estabelecimento'
                  : order.address
                    ? `${order.address.street}, ${order.address.number} — ${order.address.neighborhood}`
                    : 'Endereço não informado'}
              </Text>
            </View>
            <View style={s.actions}>
              {order.profile?.phone ? (
                <Pressable style={s.whatsappBtn} onPress={() => {
                  setContactModal({ orderId: order.id, orderNumber: order.order_number, phone: order.profile.phone });
                  setReason(''); setNote('');
                }}>
                  <ExternalLink size={16} color="#fff" />
                  <Text style={s.whatsappBtnText}>Falar com cliente</Text>
                </Pressable>
              ) : null}
              <Pressable style={s.viewBtn} onPress={() => router.push(`/operator/orders/${order.id}` as any)}>
                <ExternalLink size={16} color={Colors.primary} />
                <Text style={s.viewBtnText}>Ver pedido</Text>
              </Pressable>
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
            <View style={{ gap: 8 }}>
              <Text style={s.fieldLabel}>Motivo do contato *</Text>
              {CONTACT_REASONS.map((r) => (
                <Pressable key={r} style={[s.reasonBtn, reason === r && s.reasonBtnActive]}
                  onPress={() => setReason(r)}>
                  <View style={[s.radio, reason === r && s.radioActive]} />
                  <Text style={[s.reasonText, reason === r && s.reasonTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ gap: 6 }}>
              <Text style={s.fieldLabel}>Observação (opcional)</Text>
              <TextInput style={[s.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                value={note} onChangeText={setNote} multiline
                placeholder="Detalhes adicionais..." placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={s.formBtns}>
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
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  badgeReady: { backgroundColor: Colors.successSurface },
  badgeDelivery: { backgroundColor: Colors.infoSurface },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextReady: { color: Colors.success },
  badgeTextDelivery: { color: Colors.info },
  customer: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  deliveryInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryText: { fontSize: FontSize.sm, color: Colors.adminText, flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#25D366', borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  whatsappBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.semibold },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '15', borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.primary,
  },
  viewBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 80, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
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
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
});
