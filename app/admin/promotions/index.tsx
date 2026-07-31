import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, Alert, Switch, FlatList,
} from 'react-native';
import { Tag, Edit2, Trash2, Plus, CheckCircle, X, DollarSign } from 'lucide-react-native';
import { promotionsService } from '@/services/promotions';
import { productsService } from '@/services/products';
import { Promotion, Product } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProductImage } from '@/components/feature/ProductImage';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

const EMPTY = (): Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'product'> => ({
  product_id: null,
  promotional_price: 0,
  start_date: null,
  end_date: null,
  active: true,
});

export default function AdminPromotionsScreen() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(EMPTY());
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pr] = await Promise.all([
        promotionsService.getAll(),
        productsService.getAll({ active: true }),
      ]);
      setPromos(p);
      setProducts(pr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY()); setShowForm(true); };
  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      product_id: p.product_id,
      promotional_price: p.promotional_price,
      start_date: p.start_date,
      end_date: p.end_date,
      active: p.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.product_id) { Alert.alert('Selecione um produto'); return; }
    if (form.promotional_price <= 0) { Alert.alert('Preço inválido', 'Informe o preço promocional.'); return; }
    setSaving(true);
    try {
      if (editing) await promotionsService.update(editing.id, form);
      else await promotionsService.create(form);
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: Promotion) => {
    Alert.alert('Excluir promoção', `Excluir a promoção de "${p.product?.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await promotionsService.delete(p.id); await load(); } },
    ]);
  };

  const selectedProduct = products.find((p) => p.id === form.product_id);
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  if (loading) return <LoadingSpinner fullScreen message="Carregando promoções..." />;

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Promoções</Text>
        <Button label="Nova promoção" onPress={openNew} fullWidth />

        {promos.length === 0 ? (
          <View style={s.empty}>
            <Tag size={40} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhuma promoção criada ainda.</Text>
          </View>
        ) : null}

        {promos.map((p) => {
          const discount = p.product
            ? (((p.product.price - p.promotional_price) / p.product.price) * 100).toFixed(0)
            : null;
          return (
            <View key={p.id} style={[s.card, !p.active && s.cardOff]}>
              <View style={s.cardRow}>
                <ProductImage
                  imageUrl={p.product?.image_url}
                  productName={p.product?.name}
                  style={s.thumb}
                />
                <View style={s.cardInfo}>
                  <Text style={s.cardName} numberOfLines={1}>{p.product?.name || 'Produto'}</Text>
                  <View style={s.priceRow}>
                    {p.product ? (
                      <Text style={s.oldPrice}>R$ {p.product.price.toFixed(2).replace('.', ',')}</Text>
                    ) : null}
                    <Text style={s.newPrice}>R$ {p.promotional_price.toFixed(2).replace('.', ',')}</Text>
                    {discount ? (
                      <View style={s.discBadge}><Text style={s.discText}>-{discount}%</Text></View>
                    ) : null}
                  </View>
                  {p.start_date || p.end_date ? (
                    <Text style={s.meta}>
                      {p.start_date ? `De ${new Date(p.start_date).toLocaleDateString('pt-BR')} ` : ''}
                      {p.end_date ? `até ${new Date(p.end_date).toLocaleDateString('pt-BR')}` : ''}
                    </Text>
                  ) : null}
                  <View style={[s.statusBadge, p.active ? s.statusOn : s.statusOff]}>
                    <Text style={[s.statusText, p.active ? s.statusTextOn : s.statusTextOff]}>
                      {p.active ? 'Ativa' : 'Inativa'}
                    </Text>
                  </View>
                </View>
                <View style={s.actions}>
                  <Pressable style={s.editBtn} onPress={() => openEdit(p)}>
                    <Edit2 size={18} color={Colors.primary} />
                  </Pressable>
                  <Pressable style={s.deleteBtn} onPress={() => handleDelete(p)}>
                    <Trash2 size={18} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Form Modal */}
      <Modal visible={showForm} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalSheet} contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }} showsVerticalScrollIndicator={false}>
            <Text style={s.modalTitle}>{editing ? 'Editar promoção' : 'Nova promoção'}</Text>

            {/* Product selector */}
            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Produto *</Text>
              <Pressable style={s.productSelector} onPress={() => setShowProductPicker(true)}>
                {selectedProduct ? (
                  <View style={s.selectedProduct}>
                    <ProductImage
                      imageUrl={selectedProduct.image_url}
                      productName={selectedProduct.name}
                      style={s.selectedThumb}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.selectedName}>{selectedProduct.name}</Text>
                      <Text style={s.selectedPrice}>Preço atual: R$ {selectedProduct.price.toFixed(2).replace('.', ',')}</Text>
                    </View>
                    <Edit2 size={16} color={Colors.primary} />
                  </View>
                ) : (
                  <View style={s.selectorPlaceholder}>
                    <Plus size={18} color={Colors.primary} />
                    <Text style={{ fontSize: FontSize.sm, color: Colors.primary }}>Selecionar produto</Text>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={s.fieldLabel}>Preço promocional (R$) *</Text>
              <TextInput
                style={s.input}
                value={form.promotional_price > 0 ? String(form.promotional_price) : ''}
                onChangeText={(v) => setForm((f) => ({ ...f, promotional_price: parseFloat(v) || 0 }))}
                keyboardType="decimal-pad"
                placeholder="Ex: 4.99"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {selectedProduct && form.promotional_price > 0 ? (
              <View style={s.savingInfo}>
                <DollarSign size={16} color={Colors.success} />
                <Text style={s.savingText}>
                  Economia: R$ {Math.max(0, selectedProduct.price - form.promotional_price).toFixed(2).replace('.', ',')}
                  {' '}({Math.max(0, ((selectedProduct.price - form.promotional_price) / selectedProduct.price * 100)).toFixed(0)}% off)
                </Text>
              </View>
            ) : null}

            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Ativa</Text>
              <Switch value={form.active} onValueChange={(v) => setForm((f) => ({ ...f, active: v }))} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
            </View>

            <View style={s.formBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setShowForm(false)} />
              <Button label={editing ? 'Salvar' : 'Criar'} onPress={handleSave} loading={saving} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Product Picker Modal */}
      <Modal visible={showProductPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHeader}>
              <Text style={s.modalTitle}>Selecionar produto</Text>
              <Pressable onPress={() => setShowProductPicker(false)} hitSlop={8}>
                <X size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              style={s.pickerSearch}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Buscar produto..."
              placeholderTextColor={Colors.textMuted}
            />
            <FlatList
              data={filteredProducts}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.pickerItem, form.product_id === item.id && s.pickerItemSelected]}
                  onPress={() => {
                    setForm((f) => ({ ...f, product_id: item.id }));
                    setShowProductPicker(false);
                    setProductSearch('');
                  }}
                >
                  <ProductImage
                    imageUrl={item.image_url}
                    productName={item.name}
                    style={s.pickerThumb}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.pickerItemName}>{item.name}</Text>
                    <Text style={s.pickerItemPrice}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
                  </View>
                  {form.product_id === item.id ? (
                    <CheckCircle size={20} color={Colors.primary} />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardOff: { opacity: 0.6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  thumbPlaceholder: {
    width: 56, height: 56, borderRadius: Radius.md,
    backgroundColor: Colors.adminBackground, alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { fontSize: FontSize.sm, color: Colors.adminTextMuted, textDecorationLine: 'line-through' },
  newPrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  discBadge: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  discText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.bold },
  meta: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  statusOn: { backgroundColor: Colors.successSurface },
  statusOff: { backgroundColor: Colors.borderLight },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  statusTextOn: { color: Colors.success },
  statusTextOff: { color: Colors.adminTextMuted },
  actions: { gap: Spacing.sm },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.errorSurface, alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  productSelector: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.background, overflow: 'hidden',
  },
  selectedProduct: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm },
  selectedThumb: { width: 40, height: 40, borderRadius: Radius.sm },
  selectedName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  selectedPrice: { fontSize: FontSize.xs, color: Colors.textMuted },
  selectorPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md, justifyContent: 'center' },
  savingInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.successSurface, borderRadius: Radius.md, padding: Spacing.sm,
  },
  savingText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.medium },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
  pickerSheet: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 80, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerSearch: {
    height: 44, marginHorizontal: Spacing.md, marginVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  pickerItemSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  pickerThumb: { width: 44, height: 44, borderRadius: Radius.sm },
  pickerItemName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  pickerItemPrice: { fontSize: FontSize.xs, color: Colors.textMuted },
});
