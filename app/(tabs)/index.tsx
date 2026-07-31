import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { User, Search, Grid2x2, ImageIcon, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { ProductCard } from '@/components/feature/ProductCard';
import { CategoryCard } from '@/components/feature/CategoryCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { bannersService } from '@/services/banners';
import { Banner } from '@/types/database';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { categories } = useCategories();
  const { products: featured } = useProducts({ featured: true });
  const { products: allProducts, isLoading: loadingAll } = useProducts({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    bannersService.getActive().then(setBanners);
  }, []);

  const filteredProducts = allProducts.filter((p) => {
    return selectedCategory ? p.category_id === selectedCategory : true;
  });

  const firstName = profile?.full_name?.split(' ')[0] || 'Cliente';

  const showBanner = banners.length > 0;

  const handleBannerPress = async (link: string | null) => {
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      try {
        await Linking.openURL(link);
      } catch {
        Alert.alert('Link indisponível', 'Não foi possível abrir o destino deste banner.');
      }
      return;
    }
    router.push(link as any);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('@/assets/images/marketflow-logo.png')}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <View>
            <Text style={styles.greeting}>Olá, {firstName}!</Text>
            <Text style={styles.tagline}>O que você precisa hoje?</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
          <View style={styles.avatarCircle}>
            <User size={22} color={Colors.primary} />
          </View>
        </Pressable>
      </View>

      {/* Search */}
      <Pressable
        style={styles.searchBar}
        onPress={() => router.push('/(tabs)/products')}
      >
        <Search size={20} color={Colors.textMuted} />
        <Text style={styles.searchPlaceholder}>Buscar produtos...</Text>
      </Pressable>

      {/* Banners from DB or fallback hero */}
      {showBanner ? (
        <View style={styles.bannerWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - Spacing.lg * 2));
              setBannerIndex(idx);
            }}
            contentContainerStyle={{ gap: 0 }}
          >
            {banners.map((b) => (
              <Pressable
                key={b.id}
                style={styles.bannerSlide}
                onPress={() => handleBannerPress(b.link)}
                disabled={!b.link}
              >
                {b.image_url ? (
                  <Image source={{ uri: b.image_url }} style={styles.bannerImg} contentFit="cover" transition={200} />
                ) : (
                  <View style={[styles.bannerImg, styles.bannerNoImg]}>
                    <ImageIcon size={32} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerTitle} numberOfLines={2}>{b.title}</Text>
                  {b.description ? (
                    <Text style={styles.bannerDesc} numberOfLines={1}>{b.description}</Text>
                  ) : null}
                  {b.link ? (
                    <View style={styles.bannerAction}>
                      <Text style={styles.bannerActionText}>Toque para ver</Text>
                      <ExternalLink size={13} color="#fff" />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {banners.length > 1 ? (
            <View style={styles.dots}>
              {banners.map((_, i) => (
                <View key={i} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        /* Fallback static hero */
        <View style={styles.heroBanner}>
          <Image
            source={require('@/assets/images/hero-banner-demo.png')}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Produtos frescos{'\n'}toda semana</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Entrega rápida</Text>
            </View>
          </View>
        </View>
      )}

      {/* Categories */}
      {categories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorias</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            <Pressable
              style={styles.categoryAll}
              onPress={() => setSelectedCategory(null)}
            >
              <View style={[styles.catAllCircle, !selectedCategory && styles.catAllSelected]}>
                <Grid2x2
                  size={26}
                  color={!selectedCategory ? Colors.textOnPrimary : Colors.primary}
                />
              </View>
              <Text style={[styles.catAllText, !selectedCategory && styles.catAllTextSelected]}>
                Todos
              </Text>
            </Pressable>
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                selected={selectedCategory === cat.id}
                onPress={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Featured */}
      {!selectedCategory && featured.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.goldAccent} />
              <Text style={styles.sectionTitle}>Destaques</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productRow}
          >
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onPress={() => router.push(`/products/${p.id}`)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* All Products */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.goldAccent} />
            <Text style={styles.sectionTitle}>
              {selectedCategory
                ? categories.find((c) => c.id === selectedCategory)?.name || 'Produtos'
                : 'Todos os produtos'}
            </Text>
          </View>
          <Text style={styles.productCount}>{filteredProducts.length} itens</Text>
        </View>
        {loadingAll ? (
          <LoadingSpinner />
        ) : (
          <View style={styles.grid}>
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onPress={() => router.push(`/products/${p.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const BANNER_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },

  // Header
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLogo: { width: 44, height: 44, borderRadius: Radius.full },
  greeting: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tagline: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchPlaceholder: { fontSize: FontSize.md, color: Colors.textMuted },

  // Dynamic banners
  bannerWrapper: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_WIDTH * 0.375,
    minHeight: 128,
    position: 'relative',
  },
  bannerImg: { width: BANNER_WIDTH, height: '100%' },
  bannerNoImg: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.md, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bannerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#fff' },
  bannerDesc: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  bannerAction: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  bannerActionText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.semibold },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingVertical: 8, backgroundColor: Colors.surface,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 16 },

  // Fallback hero
  heroBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    height: 160,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  heroBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: { fontSize: FontSize.xs, color: Colors.textOnPrimary, fontWeight: FontWeight.bold },

  // Sections
  section: { marginTop: Spacing.lg },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goldAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: Colors.primary },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  productCount: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Categories
  categoryList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryAll: { alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  catAllCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  catAllSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary, ...Shadow.gold },
  catAllText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  catAllTextSelected: { color: Colors.primary, fontWeight: FontWeight.semibold },

  // Products
  productRow: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.lg },
});
