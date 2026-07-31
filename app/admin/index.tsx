import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  RefreshCw, ShoppingBag, CheckCircle, Package2, Scale, CheckSquare,
  Truck, DollarSign, Users, Package, AlertTriangle, ChevronRight,
  Warehouse, Receipt, Megaphone, Gift, UserCog,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ordersService } from '@/services/orders';
import { removeRealtimeChannel } from '@/lib/realtime';
import { Order } from '@/types/database';
import { OrderStatusBadge } from '@/components/feature/OrderStatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';

interface DashStats {
  pending: number;
  confirmed: number;
  preparing: number;
  weighing: number;
  ready: number;
  out_for_delivery: number;
  completedToday: number;
  cancelledToday: number;
  revenueToday: number;
  revenueTotal: number;
  totalCustomers: number;
  activeProducts: number;
  outOfStock: number;
}

type StatItem = {
  key: keyof DashStats;
  label: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  isMoney?: boolean;
};

const STAT_ITEMS: StatItem[] = [
  { key: 'pending',          label: 'Novos',          Icon: ShoppingBag,  color: Colors.warning,  bg: Colors.warningSurface },
  { key: 'confirmed',        label: 'Confirmados',    Icon: CheckCircle,  color: Colors.info,     bg: Colors.infoSurface },
  { key: 'preparing',        label: 'Em separação',   Icon: Package2,     color: '#9B72CF',       bg: 'rgba(155,114,207,0.15)' },
  { key: 'weighing',         label: 'Pesagem',        Icon: Scale,        color: Colors.warning,  bg: Colors.warningSurface },
  { key: 'ready',            label: 'Prontos',        Icon: CheckSquare,  color: Colors.success,  bg: Colors.successSurface },
  { key: 'out_for_delivery', label: 'Em entrega',     Icon: Truck,        color: Colors.info,     bg: Colors.infoSurface },
  { key: 'completedToday',   label: 'Concluídos hoje', Icon: CheckCircle, color: Colors.success,  bg: Colors.successSurface },
  { key: 'cancelledToday',   label: 'Cancelados hoje', Icon: AlertTriangle, color: Colors.error,  bg: Colors.errorSurface },
];

const MONEY_STATS: StatItem[] = [
  { key: 'revenueToday',   label: 'Receita hoje',    Icon: DollarSign, color: Colors.primary, bg: Colors.primarySurface, isMoney: true },
  { key: 'revenueTotal',   label: 'Receita total',   Icon: Receipt,    color: Colors.success, bg: Colors.successSurface, isMoney: true },
  { key: 'totalCustomers', label: 'Clientes',        Icon: Users,      color: Colors.info,    bg: Colors.infoSurface },
  { key: 'activeProducts', label: 'Produtos ativos', Icon: Package,    color: '#9B72CF',      bg: 'rgba(155,114,207,0.15)' },
];

type QuickAction = {
  label: string;
  Icon: LucideIcon;
  path: string;
  color: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Pedidos',     Icon: ShoppingBag,     path: '/admin/orders',    color: Colors.info },
  { label: 'Produtos',    Icon: Package,         path: '/admin/products',  color: Colors.success },
  { label: 'Marketing',   Icon: Megaphone,       path: '/admin/marketing', color: Colors.warning },
  { label: 'Delivery',    Icon: Truck,           path: '/admin/delivery',  color: Colors.primary },
  { label: 'Clube MarketFlow', Icon: Gift,           path: '/admin/loyalty',   color: '#9B72CF' },
  { label: 'Operadores',  Icon: UserCog,         path: '/admin/operators', color: Colors.textSecondary },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isWeb = Platform.OS === 'web';

  const loadData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [ordersRes, productsRes, customersRes, todayOrdersRes] = await Promise.all([
        supabase.from('orders').select('id, status, total_amount, created_at'),
        supabase.from('products').select('id, active, stock_quantity'),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('orders').select('status, total_amount').gte('created_at', todayISO),
      ]);

      const allOrders = ordersRes.data || [];
      const todayOrders = todayOrdersRes.data || [];
      const allProducts = productsRes.data || [];

      const completedToday = todayOrders.filter((o) => o.status === 'completed').length;
      const cancelledToday = todayOrders.filter((o) => ['cancelled', 'refused'].includes(o.status)).length;
      const revenueToday = todayOrders
        .filter((o) => o.status === 'completed')
        .reduce((s, o) => s + (o.total_amount || 0), 0);
      const revenueTotal = allOrders
        .filter((o) => o.status === 'completed')
        .reduce((s, o) => s + (o.total_amount || 0), 0);

      setStats({
        pending: allOrders.filter((o) => o.status === 'pending').length,
        confirmed: allOrders.filter((o) => o.status === 'confirmed').length,
        preparing: allOrders.filter((o) => o.status === 'preparing').length,
        weighing: allOrders.filter((o) => o.status === 'weighing').length,
        ready: allOrders.filter((o) => o.status === 'ready').length,
        out_for_delivery: allOrders.filter((o) => o.status === 'out_for_delivery').length,
        completedToday,
        cancelledToday,
        revenueToday,
        revenueTotal,
        totalCustomers: customersRes.count || 0,
        activeProducts: allProducts.filter((p) => p.active).length,
        outOfStock: allProducts.filter((p) => Number(p.stock_quantity) <= 0 && p.active).length,
      });

      const recent = await ordersService.getAll();
      setRecentOrders(recent.slice(0, 8));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const ch = ordersService.subscribeToAllOrders(() => loadData());
    return () => { removeRealtimeChannel(ch); };
  }, [loadData]);

  const fmt = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando dashboard..." />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Visão Geral</Text>
        <Pressable style={styles.refreshBtn} onPress={loadData} hitSlop={8}>
          <RefreshCw size={20} color={Colors.adminTextMuted} />
        </Pressable>
      </View>

      {/* Active status grid */}
      <Text style={styles.sectionLabel}>PEDIDOS EM ABERTO</Text>
      <View style={[styles.statsGrid, isWeb && styles.statsGridWide]}>
        {STAT_ITEMS.map((s) => {
          const val = stats?.[s.key] ?? 0;
          return (
            <StatCard
              key={s.key}
              Icon={s.Icon}
              label={s.label}
              value={s.isMoney ? fmt(val as number) : String(val)}
              color={s.color}
              bg={s.bg}
              onPress={s.key === 'pending' || s.key === 'ready' ? () => router.push('/admin/orders') : undefined}
            />
          );
        })}
      </View>

      {/* Revenue + summary grid */}
      <Text style={styles.sectionLabel}>RESUMO</Text>
      <View style={[styles.statsGrid, isWeb && styles.statsGridWide]}>
        {MONEY_STATS.map((s) => {
          const raw = stats?.[s.key] ?? 0;
          const display = s.isMoney ? fmt(raw as number) : String(raw);
          return (
            <StatCard key={s.key} Icon={s.Icon} label={s.label} value={display} color={s.color} bg={s.bg} />
          );
        })}
        {stats?.outOfStock ? (
          <StatCard
            Icon={AlertTriangle}
            label="Sem estoque"
            value={String(stats.outOfStock)}
            color={Colors.error}
            bg={Colors.errorSurface}
            onPress={() => router.push('/admin/products')}
          />
        ) : null}
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionLabel}>ACESSO RÁPIDO</Text>
      <View style={[styles.actionsGrid, isWeb && styles.actionsGridWide]}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.path}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(a.path as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: a.color + '22' }]}>
              <a.Icon size={22} color={a.color} />
            </View>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Operator area shortcut */}
      <Pressable style={styles.operatorBanner} onPress={() => router.push('/operator' as any)}>
        <Warehouse size={24} color={Colors.info} />
        <View style={{ flex: 1 }}>
          <Text style={styles.operatorBannerTitle}>Área Operacional</Text>
          <Text style={styles.operatorBannerSub}>Separação, pesagem, entrega e retirada</Text>
        </View>
        <ChevronRight size={20} color={Colors.info} />
      </Pressable>

      {/* Recent orders */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Últimos pedidos</Text>
        <Pressable onPress={() => router.push('/admin/orders')} hitSlop={8}>
          <Text style={styles.seeAll}>Ver todos →</Text>
        </Pressable>
      </View>

      <View style={styles.ordersTable}>
        {isWeb ? (
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableCellNr]}>Nº</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Cliente</Text>
            <Text style={styles.tableCell}>Tipo</Text>
            <Text style={styles.tableCell}>Status</Text>
            <Text style={[styles.tableCell, styles.tableCellRight]}>Total</Text>
            <Text style={[styles.tableCell, styles.tableCellRight]}>Data</Text>
          </View>
        ) : null}
        {recentOrders.map((order) => (
          <Pressable
            key={order.id}
            style={({ pressed }) => [styles.tableRow, styles.orderRow, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/admin/orders/${order.id}`)}
          >
            <Text style={[styles.tableCell, styles.tableCellNr, styles.orderNum]}>#{order.order_number}</Text>
            {isWeb ? (
              <>
                <Text style={[styles.tableCell, { flex: 2 }, styles.orderName]} numberOfLines={1}>
                  {order.profile?.full_name || 'Cliente'}
                </Text>
                <View style={styles.tableCell}>
                  <View style={styles.typeTag}>
                    {order.delivery_type === 'pickup'
                      ? <Package size={12} color={Colors.adminTextMuted} />
                      : <Truck size={12} color={Colors.adminTextMuted} />
                    }
                    <Text style={styles.typeTagText}>
                      {order.delivery_type === 'pickup' ? 'Retirada' : 'Entrega'}
                    </Text>
                  </View>
                </View>
                <View style={styles.tableCell}>
                  <OrderStatusBadge status={order.status} size="sm" />
                </View>
                <Text style={[styles.tableCell, styles.tableCellRight, styles.orderTotal]}>
                  {fmt(order.total_amount)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellRight, styles.orderDate]}>
                  {fmtDate(order.created_at)}
                </Text>
              </>
            ) : (
              <View style={styles.mobileOrderRight}>
                <View style={styles.mobileOrderInfo}>
                  <Text style={styles.orderName}>{order.profile?.full_name || 'Cliente'}</Text>
                  <OrderStatusBadge status={order.status} size="sm" />
                </View>
                <Text style={styles.orderTotal}>{fmt(order.total_amount)}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({
  Icon, label, value, color, bg, onPress,
}: {
  Icon: LucideIcon; label: string; value: string; color: string; bg: string; onPress?: () => void;
}) {
  const content = (
    <View style={[styles.statCard, { backgroundColor: bg }, onPress ? styles.statCardClickable : null]}>
      <View style={[styles.statIcon, { backgroundColor: color + '33' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={{ flex: 1, minWidth: 130 }}>
      {content}
    </Pressable>
  ) : (
    <View style={{ flex: 1, minWidth: 130 }}>{content}</View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  refreshBtn: { padding: 6 },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    color: Colors.adminTextMuted, textTransform: 'uppercase' as any, letterSpacing: 1,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statsGridWide: { gap: Spacing.md },
  statCard: { borderRadius: Radius.lg, padding: Spacing.md, gap: 6 },
  statCardClickable: { borderWidth: 1, borderColor: Colors.adminBorder },
  statIcon: {
    width: 36, height: 36, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionsGridWide: { gap: Spacing.md },
  actionCard: {
    flex: 1, minWidth: 100,
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.adminText, textAlign: 'center' },
  operatorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.infoSurface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.info + '44',
  },
  operatorBannerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  operatorBannerSub: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.adminText },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  ordersTable: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.adminBorder, overflow: 'hidden',
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  tableHeader: {
    backgroundColor: Colors.adminBackground,
    borderBottomWidth: 1, borderBottomColor: Colors.adminBorder,
  },
  orderRow: { borderBottomWidth: 1, borderBottomColor: Colors.adminBorder },
  tableCell: { flex: 1, paddingRight: 8 },
  tableCellNr: { flex: 0, width: 70 },
  tableCellRight: { textAlign: 'right' as any },
  orderNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.adminText },
  orderName: { fontSize: FontSize.sm, color: Colors.adminText },
  orderTotal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  orderDate: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  typeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.adminBackground, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  typeTagText: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  mobileOrderRight: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mobileOrderInfo: { gap: 4 },
});
