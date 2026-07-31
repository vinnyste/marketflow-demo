import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Plus, Check } from 'lucide-react-native';
import { Product } from '@/types/database';
import { Colors, Radius, FontSize, FontWeight, Spacing, Shadow } from '@/constants/theme';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { ProductImage } from '@/components/feature/ProductImage';

interface Props {
  product: Product;
  onPress?: () => void;
}

export function ProductCard({ product, onPress }: Props) {
  const { addItem, items } = useCart();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const cartItem = items.find((i) => i.product_id === product.id);
  const inCart = (cartItem?.quantity || 0) > 0;

  const handleAdd = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setAdding(true);
    try {
      const result = await addItem(product.id, product.sold_by_weight ? 0.1 : 1);
      if (result?.error) {
        Alert.alert('Erro', result.error);
      }
    } finally {
      setAdding(false);
    }
  };

  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        <ProductImage
          imageUrl={product.image_url}
          productName={product.name}
          style={styles.image}
        />
        {product.featured ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Destaque</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {product.sold_by_weight ? (
            <Text style={styles.unit}>/{product.unit}</Text>
          ) : null}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            inCart && styles.addButtonActive,
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleAdd}
          disabled={adding}
          hitSlop={4}
        >
          {inCart ? <Check size={18} color={Colors.primary} /> : <Plus size={18} color={Colors.textOnPrimary} />}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    width: 160,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  imageContainer: { position: 'relative' },
  image: {
    width: '100%',
    height: 130,
    backgroundColor: Colors.borderLight,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  info: { padding: Spacing.sm, gap: 4 },
  name: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  price: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  unit: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  addButton: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.gold,
  },
  addButtonActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
});
