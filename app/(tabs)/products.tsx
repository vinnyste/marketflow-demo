import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Search, X, RotateCcw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { ProductCard } from '@/components/feature/ProductCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ categoryId?: string | string[] }>();
  const routeCategoryId = Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(routeCategoryId || null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { categories } = useCategories();

  // Load once and filter locally. This avoids replacing the entire screen with a
  // loading state on every letter typed, which looked like a black screen in the app.
  const { products: allProducts, isLoading, error, refresh } = useProducts({});

  useEffect(() => {
    setSelectedCategory(routeCategoryId || null);
    setSelectedGroup(null);
  }, [routeCategoryId]);

  const groups = useMemo(() => {
    if (!selectedCategory) return [];
    return [
      ...new Set(
        allProducts
          .filter((product) => product.category_id === selectedCategory)
          .map((product) => product.group_name?.trim())
          .filter((group): group is string => Boolean(group))
      ),
    ].sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [allProducts, selectedCategory]);

  const products = useMemo(() => {
    const term = normalizeText(search);
    return allProducts.filter((product) => {
      if (selectedCategory && product.category_id !== selectedCategory) return false;
      if (selectedGroup && product.group_name !== selectedGroup) return false;
      if (!term) return true;
      return [product.name, product.description, product.category?.name, product.group_name]
        .some((value) => normalizeText(value).includes(term));
    });
  }, [allProducts, search, selectedCategory, selectedGroup]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Produtos</Text>
        <View style={styles.searchRow}>
          <Search size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produtos..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Limpar busca">
              <X size={18} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.categoryOuter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => {
              setSelectedCategory(null);
              setSelectedGroup(null);
            }}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>Todos</Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
              onPress={() => {
                setSelectedCategory(selectedCategory === cat.id ? null : cat.id);
                setSelectedGroup(null);
              }}
            >
              <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {selectedCategory && groups.length > 0 ? (
        <View style={styles.groupOuter}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              style={[styles.groupChip, !selectedGroup && styles.groupChipActive]}
              onPress={() => setSelectedGroup(null)}
            >
              <Text style={[styles.groupChipText, !selectedGroup && styles.groupChipTextActive]}>
                Todos os grupos
              </Text>
            </Pressable>
            {groups.map((group) => (
              <Pressable
                key={group}
                style={[styles.groupChip, selectedGroup === group && styles.groupChipActive]}
                onPress={() => setSelectedGroup(selectedGroup === group ? null : group)}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    selectedGroup === group && styles.groupChipTextActive,
                  ]}
                >
                  {group}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {isLoading ? (
        <LoadingSpinner message="Carregando produtos..." fullScreen />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Não foi possível buscar os produtos</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <RotateCcw size={18} color="#111" />
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : products.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          subtitle={search ? `Nenhum resultado para "${search}"` : 'Esta categoria está vazia'}
          icon="search-off"
          actionLabel={search ? 'Limpar busca' : undefined}
          onAction={search ? () => setSearch('') : undefined}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.md,
    height: 44, borderRadius: Radius.full,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary },
  categoryOuter: {
    minHeight: 52, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.lg, paddingVertical: 10, gap: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.borderLight,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textOnPrimary, fontWeight: FontWeight.semibold },
  groupOuter: {
    minHeight: 48,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  groupScroll: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  groupChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  groupChipTextActive: { color: '#111', fontWeight: FontWeight.semibold },
  grid: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  row: { gap: Spacing.md, justifyContent: 'space-between' },
  errorBox: {
    margin: Spacing.lg, padding: Spacing.lg, gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.error,
  },
  errorTitle: { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  errorText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  retryButton: {
    marginTop: Spacing.sm, minHeight: 46, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  retryText: { color: '#111', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
