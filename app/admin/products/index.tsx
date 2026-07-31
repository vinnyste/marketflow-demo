import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Modal, Switch, ScrollView, Alert, Platform } from 'react-native';
import { Search, Plus, Edit2, X, Database } from 'lucide-react-native';
import { productsService } from '@/services/products';
import { categoriesService } from '@/services/categories';
import { productCatalogImportService, type CatalogImportProgress } from '@/services/productCatalogImport';
import { Product, Category, ProductUnit } from '@/types/database';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { ProductImage } from '@/components/feature/ProductImage';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const UNITS: ProductUnit[] = ['un', 'kg', 'L', 'g', 'ml'];

const EMPTY_FORM = {
  name: '', description: '', price: '', unit: 'un' as ProductUnit,
  category_id: '', group_name: '', sold_by_weight: false, stock_quantity: '0',
  barcode: '', active: true, featured: false, image_url: '',
};

export default function AdminProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<CatalogImportProgress | null>(null);

  const load = async () => {
    const [p, c] = await Promise.all([
      productsService.getAll({ active: false }),
      categoriesService.getAll(false),
    ]);
    setProducts(p);
    setCategories(c);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name, description: p.description || '',
      price: String(p.price), unit: p.unit,
      category_id: p.category_id || '',
      group_name: p.group_name || '',
      sold_by_weight: p.sold_by_weight,
      stock_quantity: String(p.stock_quantity),
      barcode: p.barcode || '', active: p.active, featured: p.featured,
      image_url: p.image_url || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { alert('Nome e preço são obrigatórios.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, description: form.description || null,
        price: parseFloat(form.price.replace(',', '.')),
        unit: form.unit, category_id: form.category_id || null,
        group_name: form.group_name.trim() || null,
        sold_by_weight: form.sold_by_weight,
        stock_quantity: parseFloat(form.stock_quantity) || 0,
        barcode: form.barcode || null, active: form.active, featured: form.featured,
        image_url: form.image_url || null,
      };
      if (editingId) {
        await productsService.update(editingId, payload);
      } else {
        await productsService.create(payload);
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    await productsService.update(p.id, { active: !p.active });
    load();
  };

  const handleImportPreparedCatalog = async () => {
    const message =
      'Importar o catálogo preparado com 8.473 produtos? Produtos existentes serão atualizados pelo código de barras ou nome, sem apagar imagens cadastradas manualmente.';
    const confirmed =
      Platform.OS === 'web'
        ? (globalThis as any).confirm?.(message)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Importar catálogo', message, [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Importar', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;

    setImporting(true);
    setImportProgress(null);
    try {
      const result = await productCatalogImportService.importPreparedCatalog(
        categories,
        setImportProgress
      );
      const successMessage =
        `${result.total} produtos processados.\n` +
        `${result.inserted} novos e ${result.updated} atualizados.\n` +
        `${result.withExactImage} com imagem exata; produtos sem identificação segura ficarão sem foto.`;
      if (Platform.OS === 'web') (globalThis as any).alert?.(successMessage);
      else Alert.alert('Catálogo importado', successMessage);
      await load();
    } catch (error: any) {
      const errorMessage = error?.message || 'Não foi possível importar o catálogo.';
      if (Platform.OS === 'web') (globalThis as any).alert?.(errorMessage);
      else Alert.alert('Falha na importação', errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const filtered = products.filter((p) =>
    search ? p.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  if (isLoading) return <LoadingSpinner fullScreen message="Carregando produtos..." />;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.adminTextMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produto..."
            placeholderTextColor={Colors.adminTextMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable
          style={[styles.importBtn, importing && styles.disabledBtn]}
          onPress={handleImportPreparedCatalog}
          disabled={importing}
        >
          <Database size={18} color="#111" />
          <Text style={styles.importBtnText}>
            {importing ? 'Importando...' : 'Importar catálogo'}
          </Text>
        </Pressable>
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <Plus size={22} color="#fff" />
        </Pressable>
      </View>

      {importProgress ? (
        <View style={styles.importStatus}>
          <Text style={styles.importStatusText}>
            {importProgress.processed.toLocaleString('pt-BR')} de{' '}
            {importProgress.total.toLocaleString('pt-BR')} produtos processados
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    (importProgress.processed / Math.max(1, importProgress.total)) * 100
                  )}%` as `${number}%`,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={load}
        refreshing={isLoading}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <ProductImage
              imageUrl={item.image_url}
              productName={item.name}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.productPrice}>
                R$ {item.price.toFixed(2).replace('.', ',')} / {item.unit}
                {item.sold_by_weight ? ' ⚖️' : ''}
              </Text>
              <Text style={styles.productCategory}>
                {item.category?.name || 'Sem categoria'}
                {item.group_name ? ` › ${item.group_name}` : ''}
                {' · '}
                {item.active ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
            <View style={styles.productActions}>
              <Pressable onPress={() => openEdit(item)} hitSlop={8} style={styles.editBtn}>
                <Edit2 size={18} color={Colors.primary} />
              </Pressable>
              <Switch
                value={item.active}
                onValueChange={() => handleToggleActive(item)}
                trackColor={{ true: Colors.primary }}
                thumbColor={Colors.surface}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>
        )}
      />

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Editar produto' : 'Novo produto'}</Text>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
              <X size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Input label="Nome *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Nome do produto" autoCapitalize="words" />
            <Input label="Preço (R$) *" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboardType="decimal-pad" placeholder="0,00" />
            <Input label="Descrição" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Descrição opcional" multiline />
            <ImageUploadField
              kind="product"
              value={form.image_url}
              onChange={(image_url) => setForm((current) => ({ ...current, image_url }))}
              label="Imagem do produto"
            />
            <Input label="Estoque" value={form.stock_quantity} onChangeText={(v) => setForm({ ...form, stock_quantity: v })} keyboardType="decimal-pad" placeholder="0" />
            <Input label="Código de barras" value={form.barcode} onChangeText={(v) => setForm({ ...form, barcode: v })} placeholder="EAN-13" keyboardType="numeric" />

            {/* Unit */}
            <Text style={styles.fieldLabel}>Unidade</Text>
            <View style={styles.unitsRow}>
              {UNITS.map((u) => (
                <Pressable key={u} style={[styles.unitChip, form.unit === u && styles.unitChipActive]} onPress={() => setForm({ ...form, unit: u })}>
                  <Text style={[styles.unitText, form.unit === u && styles.unitTextActive]}>{u}</Text>
                </Pressable>
              ))}
            </View>

            {/* Category */}
            <Text style={styles.fieldLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catsRow}>
              <Pressable
                style={[styles.unitChip, !form.category_id && styles.unitChipActive]}
                onPress={() => setForm({ ...form, category_id: '' })}
              >
                <Text style={[styles.unitText, !form.category_id && styles.unitTextActive]}>Nenhuma</Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.unitChip, form.category_id === c.id && styles.unitChipActive]}
                  onPress={() => setForm({ ...form, category_id: c.id })}
                >
                  <Text style={[styles.unitText, form.category_id === c.id && styles.unitTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Input
              label="Grupo dentro da categoria"
              value={form.group_name}
              onChangeText={(v) => setForm({ ...form, group_name: v })}
              placeholder="Ex: BOVINOS, SUÍNOS, AVES"
              autoCapitalize="characters"
            />

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Vendido por peso</Text>
              <Switch value={form.sold_by_weight} onValueChange={(v) => setForm({ ...form, sold_by_weight: v })} trackColor={{ true: Colors.primary }} thumbColor={Colors.surface} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Produto ativo</Text>
              <Switch value={form.active} onValueChange={(v) => setForm({ ...form, active: v })} trackColor={{ true: Colors.primary }} thumbColor={Colors.surface} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Destaque na home</Text>
              <Switch value={form.featured} onValueChange={(v) => setForm({ ...form, featured: v })} trackColor={{ true: Colors.secondary }} thumbColor={Colors.surface} />
            </View>

            <Button label={editingId ? 'Salvar alterações' : 'Criar produto'} onPress={handleSave} loading={saving} fullWidth size="lg" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBackground },
  topBar: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.lg },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.adminSurface, paddingHorizontal: Spacing.md, height: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  searchInput: { flex: 1, minWidth: 180, fontSize: FontSize.sm, color: Colors.adminText },
  importBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  importBtnText: { color: '#111', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  disabledBtn: { opacity: 0.6 },
  addBtn: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  importStatus: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.adminSurface,
    borderWidth: 1,
    borderColor: Colors.adminBorder,
    gap: 8,
  },
  importStatusText: { color: Colors.adminText, fontSize: FontSize.sm },
  progressTrack: {
    height: 7,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.adminBorder,
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  list: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  productCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  productImage: { width: 60, height: 60, borderRadius: Radius.md, backgroundColor: Colors.adminBorder },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  productPrice: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  productCategory: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  productActions: { alignItems: 'center', gap: 6 },
  editBtn: { padding: 4 },
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalScroll: { flex: 1 },
  modalContent: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textSecondary },
  unitsRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  catsRow: { gap: 8, paddingVertical: 4 },
  unitChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.borderLight, borderWidth: 1.5, borderColor: Colors.border },
  unitChipActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  unitText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  unitTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.borderLight, borderRadius: Radius.md, padding: Spacing.md },
  toggleLabel: { fontSize: FontSize.md, color: Colors.textPrimary },
});
