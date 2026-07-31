import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, Alert, Switch, FlatList,
} from 'react-native';
import { ImageIcon, Edit2, Trash2, Tag, Bell, Info, CheckCircle, X, Plus } from 'lucide-react-native';
import { promotionsService } from '@/services/promotions';
import { productsService } from '@/services/products';
import { supabase } from '@/lib/supabase';
import { Promotion, Product } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProductImage } from '@/components/feature/ProductImage';
import AdminBannersScreen from '@/app/admin/banners/index';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

type Tab = 'banners' | 'promotions' | 'notifications';

// ─── Banners Tab ─────────────────────────────────────────────────────────────

function BannersTab() {
  return <AdminBannersScreen />;
}

// ─── Promotions Tab ──────────────────────────────────────────────────────────

const EMPTY_PROMO = (): Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'product'> => ({
  product_id: null, promotional_price: 0, start_date: null, end_date: null, active: true,
});

function PromotionsTab() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(EMPTY_PROMO());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pr] = await Promise.all([promotionsService.getAll(), productsService.getAll({ active: true })]);
      setPromos(p); setProducts(pr);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY_PROMO()); setShowForm(true); };
  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({ product_id: p.product_id, promotional_price: p.promotional_price, start_date: p.start_date, end_date: p.end_date, active: p.active });
    setShowForm(true);
  };
  const handleSave = async () => {
    if (!form.product_id) { Alert.alert('Selecione um produto'); return; }
    if (form.promotional_price <= 0) { Alert.alert('Preço inválido'); return; }
    setSaving(true);
    try {
      if (editing) await promotionsService.update(editing.id, form);
      else await promotionsService.create(form);
      setShowForm(false); await load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setSaving(false); }
  };
  const handleDelete = (p: Promotion) => {
    Alert.alert('Excluir promoção', `Excluir promoção de "${p.product?.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await promotionsService.delete(p.id); await load(); } },
    ]);
  };

  const selectedProduct = products.find((p) => p.id === form.product_id);
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <LoadingSpinner message="Carregando promoções..." />;

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Button label="Nova promoção" onPress={openNew} fullWidth />
        {promos.length === 0 ? (
          <View style={s.empty}>
            <Tag size={40} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhuma promoção criada.</Text>
          </View>
        ) : null}
        {promos.map((p) => {
          const disc = p.product
            ? (((p.product.price - p.promotional_price) / p.product.price) * 100).toFixed(0)
            : null;
          return (
            <View key={p.id} style={[s.card, !p.active && s.cardOff]}>
              <View style={s.promoRow}>
                <ProductImage
                  imageUrl={p.product?.image_url}
                  productName={p.product?.name}
                  style={s.promoThumb}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.cardName} numberOfLines={1}>{p.product?.name || 'Produto'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {p.product ? (
                      <Text style={s.oldPrice}>R$ {p.product.price.toFixed(2).replace('.', ',')}</Text>
                    ) : null}
                    <Text style={s.newPrice}>R$ {p.promotional_price.toFixed(2).replace('.', ',')}</Text>
                    {disc ? (
                      <View style={s.discBadge}><Text style={s.discText}>-{disc}%</Text></View>
                    ) : null}
                  </View>
                  <View style={[s.badge, p.active ? s.badgeOn : s.badgeOff]}>
                    <Text style={[s.badgeText, p.active ? s.badgeTextOn : s.badgeTextOff]}>
                      {p.active ? 'Ativa' : 'Inativa'}
                    </Text>
                  </View>
                </View>
                  <View style={s.actions}>
                  <Pressable style={s.editBtn} onPress={() => openEdit(p)}>
                    <Edit2 size={16} color={Colors.primary} />
                  </Pressable>
                  <Pressable style={s.deleteBtn} onPress={() => handleDelete(p)}>
                    <Trash2 size={16} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView style={s.sheet} contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}>
            <Text style={s.modalTitle}>{editing ? 'Editar promoção' : 'Nova promoção'}</Text>
            <Field label="Produto *">
              <Pressable style={s.productSelector} onPress={() => setShowPicker(true)}>
                {selectedProduct ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm }}>
                    <Text style={{ flex: 1, color: Colors.textPrimary, fontWeight: FontWeight.medium }}>{selectedProduct.name}</Text>
                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>Atual: R$ {selectedProduct.price.toFixed(2).replace('.', ',')}</Text>
                    <Edit2 size={16} color={Colors.primary} />
                  </View>
                ) : (
                  <View style={s.selectorPlaceholder}>
                    <Plus size={18} color={Colors.primary} />
                    <Text style={{ color: Colors.primary, fontSize: FontSize.sm }}>Selecionar produto</Text>
                  </View>
                )}
              </Pressable>
            </Field>
            <Field label="Preço promocional (R$) *">
              <TextInput style={s.input}
                value={form.promotional_price > 0 ? String(form.promotional_price) : ''}
                onChangeText={(v) => setForm(f => ({ ...f, promotional_price: parseFloat(v) || 0 }))}
                keyboardType="decimal-pad" placeholder="Ex: 4.99" placeholderTextColor={Colors.textMuted} />
            </Field>
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Ativa</Text>
              <Switch value={form.active} onValueChange={(v) => setForm(f => ({ ...f, active: v }))}
                trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
            </View>
            <View style={s.formBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setShowForm(false)} />
              <Button label={editing ? 'Salvar' : 'Criar'} onPress={handleSave} loading={saving} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.sheet, { flex: 1, marginTop: 80 }]}>
            <View style={s.pickerHeader}>
              <Text style={s.modalTitle}>Selecionar produto</Text>
              <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
                <X size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput style={s.pickerSearch} value={search} onChangeText={setSearch}
              placeholder="Buscar..." placeholderTextColor={Colors.textMuted} />
            <FlatList data={filtered} keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
              renderItem={({ item }) => (
                <Pressable style={[s.pickerItem, form.product_id === item.id && s.pickerItemSel]}
                  onPress={() => { setForm(f => ({ ...f, product_id: item.id })); setShowPicker(false); setSearch(''); }}>
                  <Text style={s.pickerItemName}>{item.name}</Text>
                  <Text style={s.pickerItemPrice}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
                  {form.product_id === item.id ? <CheckCircle size={18} color={Colors.primary} /> : null}
                </Pressable>
              )} />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Notifications Tab ───────────────────────────────────────────────────────

function NotificationsTab() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', target: 'all' as 'all' | 'selected' });
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notification_messages')
        .select('*')
        .order('created_at', { ascending: false });
      setNotifications(data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      Alert.alert('Preencha o título e a mensagem'); return;
    }
    setSaving(true);
    try {
      await supabase.from('notification_messages').insert({
        title: form.title.trim(),
        message: form.message.trim(),
        target: form.target,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      setShowForm(false);
      setForm({ title: '', message: '', target: 'all' });
      await load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner message="Carregando notificações..." />;

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.infoBox}>
          <Info size={14} color={Colors.info} />
          <Text style={s.infoText}>
            As notificações são registradas internamente. Push nativo será ativado em versão futura.
          </Text>
        </View>
        <Button label="Nova notificação" onPress={() => setShowForm(true)} fullWidth />
        {notifications.length === 0 ? (
          <View style={s.empty}>
            <Bell size={40} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>Nenhuma notificação enviada.</Text>
          </View>
        ) : null}
        {notifications.map((n) => (
          <View key={n.id} style={s.card}>
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{n.title}</Text>
                <Text style={s.meta} numberOfLines={2}>{n.message}</Text>
              </View>
              <View style={[s.badge, n.status === 'sent' ? s.badgeOn : s.badgeOff]}>
                <Text style={[s.badgeText, n.status === 'sent' ? s.badgeTextOn : s.badgeTextOff]}>
                  {n.status === 'sent' ? 'Enviada' : n.status === 'scheduled' ? 'Agendada' : 'Rascunho'}
                </Text>
              </View>
            </View>
            <Text style={s.timestamp}>
              {n.sent_at
                ? `Enviada em ${new Date(n.sent_at).toLocaleString('pt-BR')}`
                : `Criada em ${new Date(n.created_at).toLocaleString('pt-BR')}`}
            </Text>
            <View style={[s.badge, n.target === 'all' ? s.badgeOn : s.badgeOff]}>
              <Text style={[s.badgeText, n.target === 'all' ? s.badgeTextOn : s.badgeTextOff]}>
                {n.target === 'all' ? 'Todos os clientes' : 'Clientes selecionados'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView style={s.sheet} contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}>
            <Text style={s.modalTitle}>Nova notificação</Text>
            <Field label="Título *">
              <TextInput style={s.input} value={form.title} onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
                placeholder="Ex: Promoção do dia!" placeholderTextColor={Colors.textMuted} />
            </Field>
            <Field label="Mensagem *">
              <TextInput style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={form.message} onChangeText={(v) => setForm(f => ({ ...f, message: v }))}
                placeholder="Conteúdo da notificação..." placeholderTextColor={Colors.textMuted} multiline />
            </Field>
            <Field label="Público">
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {(['all', 'selected'] as const).map((t) => (
                  <Pressable key={t} style={[s.targetBtn, form.target === t && s.targetBtnActive]}
                    onPress={() => setForm(f => ({ ...f, target: t }))}>
                    <Text style={[s.targetBtnText, form.target === t && s.targetBtnTextActive]}>
                      {t === 'all' ? 'Todos' : 'Selecionados'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <View style={s.formBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setShowForm(false)} />
              <Button label="Enviar" onPress={handleSend} loading={saving} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Field helper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium }}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AdminMarketingScreen() {
  const [tab, setTab] = useState<Tab>('banners');

  const TABS: { key: Tab; label: string; TabIcon: any }[] = [
    { key: 'banners', label: 'Banners', TabIcon: ImageIcon },
    { key: 'promotions', label: 'Promoções', TabIcon: Tag },
    { key: 'notifications', label: 'Notificações', TabIcon: Bell },
  ];

  return (
    <View style={st.root}>
      <View style={st.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={[st.tabBtn, tab === t.key && st.tabBtnActive]}
            onPress={() => setTab(t.key)}>
            <t.TabIcon size={18}
              color={tab === t.key ? Colors.primary : Colors.adminTextMuted} />
            <Text style={[st.tabLabel, tab === t.key && st.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'banners' ? <BannersTab /> : null}
      {tab === 'promotions' ? <PromotionsTab /> : null}
      {tab === 'notifications' ? <NotificationsTab /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminBackground },
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.adminSurface,
    borderBottomWidth: 1, borderBottomColor: Colors.adminBorder,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});

const s = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardOff: { opacity: 0.6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  meta: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  link: { fontSize: FontSize.xs, color: Colors.info },
  timestamp: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  bannerImg: { width: '100%', height: 120, borderRadius: Radius.md },
  bannerPlaceholder: {
    width: '100%', height: 120, borderRadius: Radius.md,
    backgroundColor: Colors.adminBackground, alignItems: 'center', justifyContent: 'center',
  },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  promoThumb: { width: 52, height: 52, borderRadius: Radius.md },
  thumbPlaceholder: {
    backgroundColor: Colors.adminBackground, alignItems: 'center', justifyContent: 'center',
  },
  oldPrice: { fontSize: FontSize.sm, color: Colors.adminTextMuted, textDecorationLine: 'line-through' },
  newPrice: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  discBadge: {
    backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2,
  },
  discText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.bold },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeOn: { backgroundColor: Colors.successSurface },
  badgeOff: { backgroundColor: Colors.borderLight },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextOn: { color: Colors.success },
  badgeTextOff: { color: Colors.adminTextMuted },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  editBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.errorSurface, alignItems: 'center', justifyContent: 'center',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
  productSelector: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.background,
  },
  selectorPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: Spacing.md, justifyContent: 'center',
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
  pickerItemSel: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  pickerItemName: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textPrimary },
  pickerItemPrice: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.infoSurface, borderRadius: Radius.md, padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  targetBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  targetBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  targetBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  targetBtnTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
