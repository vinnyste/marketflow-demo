import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Search, Truck, Package, Scale, CreditCard, ReceiptText } from 'lucide-react-native';
import { ordersService } from '@/services/orders';
import { removeRealtimeChannel } from '@/lib/realtime';
import { Order, OrderStatus } from '@/types/database';
import { OrderStatusBadge } from '@/components/feature/OrderStatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  debit_card: 'Débito',
  credit_card: 'Crédito',
  food_voucher: 'Alimentação',
  cash: 'Dinheiro',
};

const STATUS_FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all',              label: 'Todos' },
  { key: 'pending',          label: 'Aguardando' },
  { key: 'confirmed',        label: 'Confirmados' },
  { key: 'preparing',        label: 'Preparando' },
  { key: 'weighing',         label: 'Pesagem' },
  { key: 'weighed',          label: 'Pesado' },
  { key: 'ready',            label: 'Prontos' },
  { key: 'out_for_delivery', label: 'A caminho' },
  { key: 'delivered',        label: 'Entregues' },
  { key: 'completed',        label: 'Concluídos' },
  { key: 'cancelled',        label: 'Cancelados' },
  { key: 'refused',          label: 'Recusados' },
];

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const data = await ordersService.getAll();
      setOrders(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = ordersService.subscribeToAllOrders(() => load());
    return () => { removeRealtimeChannel(channel); };
  }, []);

  const filtered = orders.filter((o) => {
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch = search
      ? String(o.order_number).includes(search) ||
        o.profile?.full_name?.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchStatus && matchSearch;
  });

  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando pedidos..." />;

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Search size={18} color={Colors.adminTextMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nº ou cliente..."
          placeholderTextColor={Colors.adminTextMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status Filter */}
      <View style={styles.filterOuter}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(i) => i.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <EmptyState title="Nenhum pedido" subtitle="Nenhum pedido encontrado com esses filtros" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <Pressable
              style={styles.orderCard}
              onPress={() => router.push(`/admin/orders/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.orderNum}>Pedido #{item.order_number}</Text>
                <OrderStatusBadge status={item.status} size="sm" />
              </View>
              <Text style={styles.customer}>{item.profile?.full_name || 'Cliente'}</Text>
              <View style={styles.cardMiddle}>
                <View style={styles.miniTag}>
                  {item.delivery_type === 'pickup'
                    ? <Package size={12} color={Colors.adminTextMuted} />
                    : <Truck size={12} color={Colors.adminTextMuted} />
                  }
                  <Text style={styles.miniTagText}>
                    {item.delivery_type === 'pickup' ? 'Retirada' : 'Entrega'}
                  </Text>
                </View>
                {item.items?.some((i) => i.sold_by_weight) ? (
                  <View style={styles.miniTag}>
                    <Scale size={12} color={Colors.warning} />
                    <Text style={[styles.miniTagText, { color: Colors.warning }]}>Por peso</Text>
                  </View>
                ) : null}
                <View style={styles.miniTag}>
                  <CreditCard size={12} color={Colors.adminTextMuted} />
                  <Text style={styles.miniTagText}>{PAYMENT_LABELS[item.payment_method] || item.payment_method}</Text>
                </View>
                {item.wants_cpf_on_invoice ? (
                  <View style={styles.miniTag}>
                    <ReceiptText size={12} color={Colors.primary} />
                    <Text style={[styles.miniTagText, { color: Colors.primary, fontWeight: FontWeight.bold }]}>CPF</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                <Text style={styles.items}>{item.items?.length || 0} itens</Text>
                <Text style={styles.total}>{formatPrice(item.total_amount)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBackground },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.adminSurface, margin: Spacing.lg,
    paddingHorizontal: Spacing.md, height: 44, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.adminText },
  filterOuter: { marginBottom: Spacing.sm },
  filterList: { paddingHorizontal: Spacing.lg, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.adminSurface, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.xs, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
  filterTextActive: { color: '#fff', fontWeight: FontWeight.semibold },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  orderCard: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: 6, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  customer: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  cardMiddle: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  miniTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.adminBackground, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  miniTagText: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 },
  date: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  items: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  total: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary, marginLeft: 'auto' as any },
});
