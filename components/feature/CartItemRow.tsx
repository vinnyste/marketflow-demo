import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { CartItem } from '@/types/database';
import { Colors, Radius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useCart } from '@/hooks/useCart';
import { ProductImage } from '@/components/feature/ProductImage';

interface Props {
  item: CartItem;
}

export function CartItemRow({ item }: Props) {
  const { updateQuantity, removeItem } = useCart();
  const product = item.product;
  if (!product) return null;

  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;
  const total = product.price * item.quantity;
  const normalizedQuantity = (value: number) => Math.round(value * 1000) / 1000;

  return (
    <View style={styles.row}>
      <ProductImage
        imageUrl={product.image_url}
        productName={product.name}
        style={styles.image}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.unitPrice}>{formatPrice(product.price)}{product.sold_by_weight ? `/${product.unit}` : ''}</Text>
        <View style={styles.bottom}>
          <View style={styles.qtyControl}>
            <Pressable
              onPress={() => updateQuantity(item.id, normalizedQuantity(item.quantity - (product.sold_by_weight ? 0.1 : 1)))}
              style={styles.qtyBtn}
              hitSlop={8}
            >
              <Minus size={16} color={Colors.primary} />
            </Pressable>
            <Text style={styles.qty}>
              {product.sold_by_weight
                ? `${item.quantity.toFixed(3)} ${product.unit}`
                : item.quantity}
            </Text>
            <Pressable
              onPress={() => updateQuantity(item.id, normalizedQuantity(item.quantity + (product.sold_by_weight ? 0.1 : 1)))}
              style={styles.qtyBtn}
              hitSlop={8}
            >
              <Plus size={16} color={Colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.total}>{formatPrice(total)}</Text>
        </View>
      </View>
      <Pressable onPress={() => removeItem(item.id)} style={styles.removeBtn} hitSlop={8}>
        <X size={18} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Colors.borderLight,
  },
  info: { flex: 1, gap: 4 },
  name: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  unitPrice: { fontSize: FontSize.xs, color: Colors.textMuted },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary, minWidth: 32, textAlign: 'center' },
  total: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  removeBtn: { padding: 4 },
});
