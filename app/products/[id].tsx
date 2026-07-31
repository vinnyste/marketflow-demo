import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Scale, Info, AlertCircle, Minus, Plus } from 'lucide-react-native';
import { Product } from '@/types/database';
import { productsService } from '@/services/products';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProductImage } from '@/components/feature/ProductImage';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

function imageAttribution(imageUrl: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.includes('openbeautyfacts')) {
    return { label: 'Open Beauty Facts', url: 'https://world.openbeautyfacts.org/' };
  }
  if (imageUrl.includes('openproductsfacts')) {
    return { label: 'Open Products Facts', url: 'https://world.openproductsfacts.org/' };
  }
  if (imageUrl.includes('openfoodfacts')) {
    return { label: 'Open Food Facts', url: 'https://world.openfoodfacts.org/' };
  }
  return null;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { addItem, items, updateQuantity } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const cartItem = items.find((i) => i.product_id === id);
  const qty = cartItem?.quantity || 0;

  useEffect(() => {
    if (id) {
      productsService.getById(id).then((p) => {
        setProduct(p);
        setIsLoading(false);
      });
    }
  }, [id]);

  const handleAdd = async () => {
    if (!user) { router.push('/auth/login'); return; }
    setAdding(true);
    try {
      await addItem(product!.id, product!.sold_by_weight ? 0.1 : 1);
    } finally {
      setAdding(false);
    }
  };

  const formatPrice = (p: number) => `R$ ${p.toFixed(2).replace('.', ',')}`;

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando produto..." />;
  if (!product) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>Produto não encontrado</Text>
    </View>
  );
  const attribution = imageAttribution(product.image_url);

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Image */}
      <ProductImage
        imageUrl={product.image_url}
        productName={product.name}
        style={styles.image}
        transition={300}
      />
      {attribution ? (
        <Pressable
          style={styles.imageCredit}
          onPress={() => Linking.openURL(attribution.url)}
        >
          <Text style={styles.imageCreditText}>
            Imagem colaborativa: {attribution.label} · CC BY-SA
          </Text>
        </Pressable>
      ) : null}

      {/* Info */}
      <View style={styles.body}>
        {product.category ? (
          <Text style={styles.category}>{product.category.name}</Text>
        ) : null}
        <Text style={styles.name}>{product.name}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {product.sold_by_weight ? (
            <View style={styles.weightBadge}>
              <Scale size={14} color={Colors.secondary} />
              <Text style={styles.weightText}>Vendido por {product.unit}</Text>
            </View>
          ) : (
            <Text style={styles.unit}>/ {product.unit}</Text>
          )}
        </View>

        {product.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descTitle}>Descrição</Text>
            <Text style={styles.desc}>{product.description}</Text>
          </View>
        ) : null}

        {product.sold_by_weight ? (
          <View style={styles.infoBox}>
            <Info size={16} color={Colors.info} />
            <Text style={styles.infoText}>
              Produto vendido por peso. Você escolhe a quantidade estimada e o valor final é calculado na pesagem.
            </Text>
          </View>
        ) : null}

        {product.stock_quantity <= 0 ? (
          <View style={styles.outOfStock}>
            <AlertCircle size={16} color={Colors.error} />
            <Text style={styles.outOfStockText}>Produto indisponível</Text>
          </View>
        ) : null}
      </View>

      {/* Add to Cart */}
      <View style={styles.footer}>
        {qty > 0 ? (
          <View style={styles.qtyRow}>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => updateQuantity(cartItem!.id, qty - (product.sold_by_weight ? 0.1 : 1))}
            >
              <Minus size={20} color={Colors.primary} />
            </Pressable>
            <Text style={styles.qtyText}>
              {product.sold_by_weight ? `${qty.toFixed(3)} ${product.unit}` : qty}
            </Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => addItem(product.id, product.sold_by_weight ? 0.1 : 1)}
            >
              <Plus size={20} color={Colors.primary} />
            </Pressable>
          </View>
        ) : null}
        <Button
          label={qty > 0 ? 'Adicionar mais' : 'Adicionar ao carrinho'}
          onPress={handleAdd}
          loading={adding}
          disabled={product.stock_quantity <= 0}
          fullWidth
          size="lg"
        />
        {qty > 0 ? (
          <Button
            label="Ver carrinho"
            onPress={() => router.push('/(tabs)/cart')}
            variant="outline"
            fullWidth
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  image: { width: '100%', height: 280, backgroundColor: Colors.borderLight },
  imageCredit: { alignSelf: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: 6 },
  imageCreditText: { color: Colors.textMuted, fontSize: FontSize.xs },
  body: { padding: Spacing.lg, gap: Spacing.md },
  category: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium, textTransform: 'uppercase' },
  name: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, lineHeight: 32 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  price: { fontSize: FontSize.display, fontWeight: FontWeight.bold, color: Colors.primary },
  unit: { fontSize: FontSize.md, color: Colors.textMuted },
  weightBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondarySurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  weightText: { fontSize: FontSize.sm, color: Colors.secondary, fontWeight: FontWeight.medium },
  descSection: { gap: 8 },
  descTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  desc: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.infoSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.info, lineHeight: 20 },
  outOfStock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outOfStockText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: FontWeight.medium },
  footer: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  qtyBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary, minWidth: 60, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: FontSize.lg, color: Colors.textSecondary },
});
