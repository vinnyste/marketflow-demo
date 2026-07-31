import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Search, Store, Truck, Scale, Receipt, CreditCard, ReceiptText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { createRealtimeTopic, removeRealtimeChannel } from '@/lib/realtime';
import { Order, OrderStatus } from '@/types/database';
import { OrderStatusBadge } from '@/components/feature/OrderStatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const OPERATOR_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'weighing', 'weighed', 'ready', 'out_for_delivery',
];

const FILTERS: { key: 'active' | 'all'; label: string }[] = [
  { key: 'active', label: 'Ativos' },
  { key: 'all', label: 'Todos' },
];

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  debit_card: 'Débito',
  credit_card: 'Crédito',
  food_voucher: 'Alimentação',
  cash: 'Dinheiro',
};

export default function OperatorOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const q = supabase
      .from('orders')
      .select('*, address:addresses(*), profile:user_profiles(full_name, phone), items:order_items(*, product:products(name, sold_by_weight, unit))');

    if (filter === 'active') {
      q.in('status', OPERATOR_STATUSES);
    }

    const { data } = await q.order('created_at', { ascending: false }).limit(100);
    setOrders((data || []) as Order[]);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(createRealtimeTopic('op:orders:list'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { removeRealtimeChannel(ch); };
  }, [load]);

  const filtered = search
    ? orders.filter((o) =>
        String(o.order_number).includes(search) ||
        (o as any).profile?.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;

  if (loading) return <LoadingSpinner fullScreen message="Carregando pedidos..." />;

  return (
    <View style={s.root}>
      {/* Search */}
      <View style={s.searchBar}>
        <Search size={18} color={Colors.adminTextMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar nº ou cliente..."
          placeholderTextColor={Colors.adminTextMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter tabs */}
      <View style={s.tabs}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[s.tab, filter === f.key && s.tabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.tabText, filter === f.key && s.tabTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Receipt size={40} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhum pedido encontrado.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const hasWeight = item.items?.some((i) => i.sold_by_weight || i.product?.sold_by_weight);
          return (
            <Pressable style={s.card} onPress={() => router.push(`/operator/orders/${item.id}` as any)}>
              <View style={s.cardTop}>
                <Text style={s.orderNum}>#{item.order_number}</Text>
                <OrderStatusBadge status={item.status} size="sm" />
              </View>
              <Text style={s.customer}>{(item as any).profile?.full_name || 'Cliente'}</Text>
              <View style={s.meta}>
                <View style={s.metaTag}>
                  {item.delivery_type === 'pickup' ? <Store size={12} color={Colors.adminTextMuted} /> : <Truck size={12} color={Colors.adminTextMuted} />}
                  <Text style={s.metaText}>{item.delivery_type === 'pickup' ? 'Retirada' : 'Entrega'}</Text>
                </View>
                {hasWeight ? (
                  <View style={s.metaTag}>
                    <Scale size={12} color={Colors.warning} />
                    <Text style={[s.metaText, { color: Colors.warning }]}>Tem peso</Text>
                  </View>
                ) : null}
                <View style={s.metaTag}>
                  <CreditCard size={12} color={Colors.adminTextMuted} />
                  <Text style={s.metaText}>{PAYMENT_LABELS[item.payment_method] || item.payment_method}</Text>
                </View>
                {item.wants_cpf_on_invoice ? (
                  <View style={s.metaTag}>
                    <ReceiptText size={12} color={Colors.primary} />
                    <Text style={[s.metaText, { color: Colors.primary, fontWeight: FontWeight.bold }]}>CPF</Text>
                  </View>
                ) : null}
                <Text style={s.metaTime}>
                  {new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={s.total}>{formatPrice(item.total_amount)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminBackground },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.adminSurface, margin: Spacing.md,
    paddingHorizontal: Spacing.md, height: 44, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.adminText },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.adminBorder,
    backgroundColor: Colors.adminSurface,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: 6, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  customer: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  metaTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.adminBackground, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  metaText: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  metaTime: { fontSize: FontSize.xs, color: Colors.adminTextMuted, marginLeft: 'auto' as any },
  total: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
});
