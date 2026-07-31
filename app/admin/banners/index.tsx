import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, Alert, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ImageOff, Edit2, Trash2, Link2, Package, Tags,
  Globe2, LayoutGrid, Check,
} from 'lucide-react-native';
import { bannersService } from '@/services/banners';
import { productsService } from '@/services/products';
import { categoriesService } from '@/services/categories';
import { Banner, Product, Category } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

type DestinationType = 'none' | 'products' | 'product' | 'category' | 'external';

const EMPTY = (): Omit<Banner, 'id' | 'created_at' | 'updated_at'> => ({
  title: '',
  description: '',
  image_url: '',
  link: '',
  sort_order: 0,
  start_date: null,
  end_date: null,
  active: true,
});

const DESTINATIONS: { type: DestinationType; label: string; Icon: any }[] = [
  { type: 'none', label: 'Sem ação', Icon: Link2 },
  { type: 'products', label: 'Todos os produtos', Icon: LayoutGrid },
  { type: 'product', label: 'Um produto', Icon: Package },
  { type: 'category', label: 'Uma categoria', Icon: Tags },
  { type: 'external', label: 'Link externo', Icon: Globe2 },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={f.label}>{label}</Text>
      {children}
    </View>
  );
}

const f = StyleSheet.create({
  label: { fontSize: FontSize.sm, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
});

function parseDestination(link: string | null): {
  type: DestinationType;
  targetId: string;
  externalLink: string;
} {
  const value = (link || '').trim();
  if (!value) return { type: 'none', targetId: '', externalLink: '' };

  const productMatch = value.match(/^\/products\/([^/?#]+)/);
  if (productMatch) return { type: 'product', targetId: decodeURIComponent(productMatch[1]), externalLink: '' };

  const categoryMatch = value.match(/[?&]categoryId=([^&#]+)/);
  if (categoryMatch) return { type: 'category', targetId: decodeURIComponent(categoryMatch[1]), externalLink: '' };

  if (value === '/(tabs)/products' || value === '/products') {
    return { type: 'products', targetId: '', externalLink: '' };
  }

  return { type: 'external', targetId: '', externalLink: value };
}

function buildDestination(type: DestinationType, targetId: string, externalLink: string): string | null {
  if (type === 'none') return null;
  if (type === 'products') return '/(tabs)/products';
  if (type === 'product') return targetId ? `/products/${targetId}` : null;
  if (type === 'category') return targetId ? `/(tabs)/products?categoryId=${encodeURIComponent(targetId)}` : null;
  const value = externalLink.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export default function AdminBannersScreen() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState(EMPTY());
  const [saving, setSaving] = useState(false);
  const [destinationType, setDestinationType] = useState<DestinationType>('none');
  const [destinationId, setDestinationId] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bannerData, productData, categoryData] = await Promise.all([
        bannersService.getAll(),
        productsService.getAll(),
        categoriesService.getAll(),
      ]);
      setBanners(bannerData);
      setProducts(productData);
      setCategories(categoryData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 40);
  }, [products, productSearch]);

  const resetDestination = () => {
    setDestinationType('none');
    setDestinationId('');
    setExternalLink('');
    setProductSearch('');
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY());
    resetDestination();
    setShowForm(true);
  };

  const openEdit = (banner: Banner) => {
    const parsed = parseDestination(banner.link);
    setEditing(banner);
    setForm({
      title: banner.title,
      description: banner.description ?? '',
      image_url: banner.image_url ?? '',
      link: banner.link ?? '',
      sort_order: banner.sort_order,
      start_date: banner.start_date,
      end_date: banner.end_date,
      active: banner.active,
    });
    setDestinationType(parsed.type);
    setDestinationId(parsed.targetId);
    setExternalLink(parsed.externalLink);
    setProductSearch('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Título obrigatório', 'Informe o título do banner.');
      return;
    }
    if (!form.image_url) {
      Alert.alert('Imagem obrigatória', 'Escolha uma imagem adequada para o banner.');
      return;
    }
    if ((destinationType === 'product' || destinationType === 'category') && !destinationId) {
      Alert.alert('Destino obrigatório', 'Selecione o produto ou a categoria que o banner deve abrir.');
      return;
    }
    if (destinationType === 'external' && !externalLink.trim()) {
      Alert.alert('Link obrigatório', 'Informe o link que o banner deve abrir.');
      return;
    }

    setSaving(true);
    try {
      const link = buildDestination(destinationType, destinationId, externalLink);
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        image_url: form.image_url || null,
        link,
      };
      if (editing) await bannersService.update(editing.id, payload);
      else await bannersService.create(payload);
      setShowForm(false);
      await load();
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível salvar o banner.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (banner: Banner) => {
    Alert.alert('Excluir banner', `Excluir "${banner.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await bannersService.delete(banner.id);
          await load();
        },
      },
    ]);
  };

  const destinationLabel = (banner: Banner) => {
    const parsed = parseDestination(banner.link);
    if (parsed.type === 'none') return 'Sem ação';
    if (parsed.type === 'products') return 'Abre todos os produtos';
    if (parsed.type === 'product') {
      return `Produto: ${products.find((p) => p.id === parsed.targetId)?.name || 'selecionado'}`;
    }
    if (parsed.type === 'category') {
      return `Categoria: ${categories.find((c) => c.id === parsed.targetId)?.name || 'selecionada'}`;
    }
    return `Link: ${parsed.externalLink}`;
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando banners..." />;

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Banners</Text>
        <Text style={s.pageSubtitle}>Crie banners clicáveis para produtos, categorias ou links externos.</Text>
        <Button label="Novo banner" onPress={openNew} fullWidth />

        {banners.length === 0 ? (
          <View style={s.empty}>
            <ImageOff size={40} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhum banner criado ainda.</Text>
          </View>
        ) : null}

        {banners.map((banner) => (
          <View key={banner.id} style={[s.card, !banner.active && s.cardOff]}>
            {banner.image_url ? (
              <Image source={{ uri: banner.image_url }} style={s.preview} contentFit="cover" />
            ) : (
              <View style={s.noImg}>
                <ImageOff size={28} color={Colors.adminTextMuted} />
              </View>
            )}
            <View style={s.cardBody}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle} numberOfLines={1}>{banner.title}</Text>
                <View style={[s.badge, banner.active ? s.badgeOn : s.badgeOff]}>
                  <Text style={[s.badgeText, banner.active ? s.badgeTextOn : s.badgeTextOff]}>
                    {banner.active ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              </View>
              {banner.description ? <Text style={s.cardDesc} numberOfLines={2}>{banner.description}</Text> : null}
              <View style={s.destinationSummary}>
                <Link2 size={14} color={banner.link ? Colors.primary : Colors.adminTextMuted} />
                <Text style={s.destinationSummaryText} numberOfLines={2}>{destinationLabel(banner)}</Text>
              </View>
              <Text style={s.meta}>Ordem: {banner.sort_order}</Text>
              <View style={s.cardActions}>
                <Pressable style={s.editBtn} onPress={() => openEdit(banner)}>
                  <Edit2 size={16} color={Colors.primary} />
                  <Text style={s.editBtnText}>Editar</Text>
                </Pressable>
                <Pressable style={s.deleteBtn} onPress={() => handleDelete(banner)}>
                  <Trash2 size={16} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView
            style={s.modalSheet}
            contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.modalTitle}>{editing ? 'Editar banner' : 'Novo banner'}</Text>

            <Field label="Título *">
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                placeholder="Título do banner"
                placeholderTextColor={Colors.textMuted}
              />
            </Field>

            <Field label="Descrição">
              <TextInput
                style={[s.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                value={form.description ?? ''}
                onChangeText={(description) => setForm((current) => ({ ...current, description }))}
                placeholder="Descrição opcional"
                multiline
                placeholderTextColor={Colors.textMuted}
              />
            </Field>

            <ImageUploadField
              kind="banner"
              value={form.image_url ?? ''}
              onChange={(image_url) => setForm((current) => ({ ...current, image_url }))}
              label="Imagem do banner *"
            />

            <Field label="O que acontece quando o cliente toca no banner?">
              <View style={s.destinationGrid}>
                {DESTINATIONS.map(({ type, label, Icon }) => {
                  const active = destinationType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[s.destinationChip, active && s.destinationChipActive]}
                      onPress={() => {
                        setDestinationType(type);
                        setDestinationId('');
                        if (type !== 'external') setExternalLink('');
                      }}
                    >
                      <Icon size={17} color={active ? '#111' : Colors.textSecondary} />
                      <Text style={[s.destinationChipText, active && s.destinationChipTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {destinationType === 'product' ? (
              <Field label="Selecione o produto">
                <TextInput
                  style={s.input}
                  value={productSearch}
                  onChangeText={setProductSearch}
                  placeholder="Buscar produto..."
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={s.selectionList}>
                  {filteredProducts.map((product) => {
                    const selected = destinationId === product.id;
                    return (
                      <Pressable
                        key={product.id}
                        style={[s.selectionRow, selected && s.selectionRowSelected]}
                        onPress={() => setDestinationId(product.id)}
                      >
                        <Text style={[s.selectionText, selected && s.selectionTextSelected]} numberOfLines={1}>
                          {product.name}
                        </Text>
                        {selected ? <Check size={18} color={Colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            {destinationType === 'category' ? (
              <Field label="Selecione a categoria">
                <View style={s.destinationGrid}>
                  {categories.map((category) => {
                    const selected = destinationId === category.id;
                    return (
                      <Pressable
                        key={category.id}
                        style={[s.destinationChip, selected && s.destinationChipActive]}
                        onPress={() => setDestinationId(category.id)}
                      >
                        <Tags size={17} color={selected ? '#111' : Colors.textSecondary} />
                        <Text style={[s.destinationChipText, selected && s.destinationChipTextActive]}>
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            {destinationType === 'external' ? (
              <Field label="Link externo">
                <TextInput
                  style={s.input}
                  value={externalLink}
                  onChangeText={setExternalLink}
                  placeholder="https://..."
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholderTextColor={Colors.textMuted}
                />
              </Field>
            ) : null}

            <Field label="Ordem de exibição">
              <TextInput
                style={s.input}
                value={String(form.sort_order)}
                onChangeText={(value) => setForm((current) => ({ ...current, sort_order: parseInt(value, 10) || 0 }))}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </Field>

            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Banner ativo</Text>
              <Switch
                value={form.active}
                onValueChange={(active) => setForm((current) => ({ ...current, active }))}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={s.formBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setShowForm(false)} />
              <Button label={editing ? 'Salvar' : 'Criar'} onPress={handleSave} loading={saving} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminBackground },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  pageSubtitle: { fontSize: FontSize.sm, color: Colors.adminTextMuted, marginTop: -8 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardOff: { opacity: 0.65 },
  preview: { width: '100%', aspectRatio: 8 / 3 },
  noImg: {
    width: '100%', height: 100, backgroundColor: Colors.adminBackground,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: Spacing.md, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  badgeOn: { backgroundColor: Colors.successSurface },
  badgeOff: { backgroundColor: Colors.borderLight },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextOn: { color: Colors.success },
  badgeTextOff: { color: Colors.adminTextMuted },
  cardDesc: { fontSize: FontSize.sm, color: Colors.adminTextMuted, lineHeight: 18 },
  destinationSummary: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.adminBackground, borderRadius: Radius.sm, padding: 8,
  },
  destinationSummaryText: { flex: 1, fontSize: FontSize.xs, color: Colors.adminTextMuted },
  meta: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '15', borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.errorSurface, alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    flex: 1, backgroundColor: Colors.surface, marginTop: 40,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  destinationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  destinationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 42, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md, backgroundColor: Colors.borderLight,
    borderWidth: 1, borderColor: Colors.border,
  },
  destinationChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  destinationChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  destinationChipTextActive: { color: '#111', fontWeight: FontWeight.bold },
  selectionList: {
    maxHeight: 260, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.background,
  },
  selectionRow: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  selectionRowSelected: { backgroundColor: Colors.primarySurface },
  selectionText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  selectionTextSelected: { color: Colors.primary, fontWeight: FontWeight.bold },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
});
