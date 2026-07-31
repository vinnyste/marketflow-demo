import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/hooks/useCart';
import { CartItemRow } from '@/components/feature/CartItemRow';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Shadow } from '@/constants/theme';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { items, isLoading, totalPrice, totalItems, clearCart } = useCart();

  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.goldBar} />
          <Text style={styles.title}>Carrinho</Text>
        </View>
        {items.length > 0 ? (
          <Pressable onPress={clearCart} hitSlop={8}>
            <Text style={styles.clearText}>Limpar tudo</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Carregando carrinho..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="Seu carrinho está vazio"
          subtitle="Adicione produtos para continuar"
          imageSource={require('@/assets/images/empty-cart.png')}
          actionLabel="Ver produtos"
          onAction={() => router.push('/(tabs)/products')}
        />
      ) : (
        <>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} />
            ))}
          </ScrollView>

          {/* Summary */}
          <View style={[styles.summary, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</Text>
              <Text style={styles.summaryValue}>{formatPrice(totalPrice)}</Text>
            </View>
            <View style={styles.divider} />
            <Button
              label="Finalizar pedido"
              onPress={() => router.push('/checkout')}
              fullWidth
              size="lg"
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goldBar: { width: 3, height: 22, borderRadius: 2, backgroundColor: Colors.primary },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  clearText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: FontWeight.medium },
  list: { flex: 1 },
  listContent: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 20 },
  summary: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.lg,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border },
});
