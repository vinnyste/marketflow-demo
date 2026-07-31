import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Redirect, Slot, router, usePathname } from 'expo-router';
import {
  Bell, ListOrdered, ClipboardList, Scale, Truck,
  CheckCircle, History, LogOut, LayoutDashboard,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const NAV_ITEMS = [
  { label: 'Novos Pedidos',    Icon: Bell,          path: '/operator' },
  { label: 'Meus Pedidos',     Icon: ListOrdered,   path: '/operator/orders' },
  { label: 'Separação',        Icon: ClipboardList, path: '/operator/separation' },
  { label: 'Pesagem',          Icon: Scale,         path: '/operator/weighing' },
  { label: 'Entrega/Retirada', Icon: Truck,         path: '/operator/delivery' },
  { label: 'Prontos',          Icon: CheckCircle,   path: '/operator/ready' },
  { label: 'Histórico',        Icon: History,       path: '/operator/history' },
];

const MOBILE_NAV = NAV_ITEMS.filter((i) =>
  ['/operator', '/operator/separation', '/operator/weighing', '/operator/delivery', '/operator/ready'].includes(i.path)
);

export default function OperatorLayout() {
  const { isOperator, isAdmin, authInitialized, signOut, profile } = useAuth();
  const pathname = usePathname();
  if (!authInitialized) return <LoadingSpinner fullScreen message="Verificando acesso..." />;
  if (!isOperator) return <Redirect href="/admin-login" />;

  const isWeb = Platform.OS === 'web';

  return (
    <View style={[styles.root, isWeb && styles.rootWeb]}>
      {/* ── Sidebar (web) ───────────────────────────────────────────────────── */}
      {isWeb ? (
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Image
              source={require('@/assets/images/marketflow-logo.png')}
              style={styles.sidebarLogo}
              contentFit="contain"
            />
            <Text style={styles.sidebarRole}>Operacional</Text>
          </View>

          <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.path === '/operator'
                  ? pathname === '/operator'
                  : pathname.startsWith(item.path);
              return (
                <Pressable
                  key={item.path}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => router.push(item.path as any)}
                >
                  <item.Icon
                    size={18}
                    color={isActive ? Colors.primary : Colors.adminTextMuted}
                  />
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Admin area link (only for admins) */}
            {isAdmin ? (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={styles.navItem}
                  onPress={() => router.push('/admin' as any)}
                >
                  <LayoutDashboard size={18} color={Colors.primary} />
                  <Text style={[styles.navLabel, { color: Colors.primary }]}>
                    Painel Admin
                  </Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.userFooter}>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {profile?.full_name || 'Operador'}
              </Text>
              <Text style={styles.userRole}>
                {profile?.role === 'admin' ? 'Administrador' : 'Operador'}
              </Text>
            </View>
            <Pressable
              onPress={() => signOut().then(() => router.replace('/admin-login'))}
              style={styles.signOutBtn}
              hitSlop={8}
            >
              <LogOut size={18} color={Colors.adminTextMuted} />
            </Pressable>
          </View>
        </View>
      ) : (
        /* Mobile header */
        <View style={styles.mobileHeader}>
          <Image
            source={require('@/assets/images/marketflow-logo.png')}
            style={styles.mobileLogo}
            contentFit="contain"
          />
          <Pressable
            onPress={() => signOut().then(() => router.replace('/admin-login'))}
            hitSlop={8}
          >
            <LogOut size={20} color={Colors.adminTextMuted} />
          </Pressable>
        </View>
      )}

      <View style={styles.main}>
        <Slot />
      </View>

      {/* Mobile Bottom Nav */}
      {!isWeb ? (
        <View style={styles.mobileNav}>
          {MOBILE_NAV.map((item) => {
            const isActive =
              item.path === '/operator'
                ? pathname === '/operator'
                : pathname.startsWith(item.path);
            return (
              <Pressable
                key={item.path}
                style={styles.mobileNavItem}
                onPress={() => router.push(item.path as any)}
              >
                <item.Icon
                  size={22}
                  color={isActive ? Colors.primary : Colors.adminTextMuted}
                />
                <Text style={[styles.mobileNavLabel, isActive && styles.mobileNavLabelActive]}>
                  {item.label.split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminBackground },
  rootWeb: { flexDirection: 'row' },

  sidebar: {
    width: 220,
    backgroundColor: Colors.adminSurface,
    borderRightWidth: 1,
    borderRightColor: Colors.adminBorder,
    paddingTop: 24,
  },
  sidebarHeader: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.adminBorder,
  },
  sidebarLogo: { width: 130, height: 48 },
  sidebarRole: { fontSize: FontSize.xs, color: Colors.info, fontWeight: FontWeight.semibold },

  sidebarNav: { flex: 1, paddingVertical: Spacing.sm },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    marginHorizontal: 8, borderRadius: Radius.md,
  },
  navItemActive: { backgroundColor: 'rgba(201,168,76,0.12)' },
  navLabel: { fontSize: FontSize.sm, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
  navLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  divider: {
    height: 1, backgroundColor: Colors.adminBorder,
    marginHorizontal: Spacing.md, marginVertical: Spacing.sm,
  },

  userFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.adminBorder,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.adminText },
  userRole: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  signOutBtn: { padding: 6 },

  main: { flex: 1, overflow: 'hidden' },

  mobileHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12, paddingTop: 48,
    backgroundColor: Colors.adminSurface,
    borderBottomWidth: 1, borderBottomColor: Colors.adminBorder,
  },
  mobileLogo: { width: 110, height: 36 },

  mobileNav: {
    flexDirection: 'row', backgroundColor: Colors.adminSurface,
    borderTopWidth: 1, borderTopColor: Colors.adminBorder, paddingBottom: 20,
  },
  mobileNavItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4 },
  mobileNavLabel: { fontSize: 9, color: Colors.adminTextMuted },
  mobileNavLabelActive: { color: Colors.primary },
});
