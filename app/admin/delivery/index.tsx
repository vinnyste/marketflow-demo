import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, Alert, Switch,
} from 'react-native';
import { MapPin, Edit2, Trash2, Store, Truck, ShoppingBag, Check, Clock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { settingsService } from '@/services/settings';
import { DeliveryZone } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

type Tab = 'zones' | 'hours' | 'options';

const DAYS = [
  { key: '0', label: 'Dom' }, { key: '1', label: 'Seg' }, { key: '2', label: 'Ter' },
  { key: '3', label: 'Qua' }, { key: '4', label: 'Qui' }, { key: '5', label: 'Sex' },
  { key: '6', label: 'Sáb' },
];

// ─── Zones Tab ───────────────────────────────────────────────────────────────

const EMPTY_ZONE = (): Omit<DeliveryZone, 'id' | 'created_at' | 'updated_at'> => ({
  neighborhood: '', city: '', state: 'PR', zone_name: null,
  delivery_fee: 0, active: true, estimated_minutes: 45,
  min_delivery_minutes: 45, max_delivery_minutes: 60, free_delivery_above: null,
});

function ZonesTab() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState(EMPTY_ZONE());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('neighborhood');
      if (error) throw error;
      setZones((data || []) as DeliveryZone[]);
    } catch (e: any) {
      setZones([]);
      setLoadError(e?.message || 'Não foi possível carregar os bairros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY_ZONE()); setShowForm(true); };
  const openEdit = (z: DeliveryZone) => {
    setEditing(z);
    setForm({
      neighborhood: z.neighborhood, city: z.city || '', state: z.state || 'PR',
      zone_name: z.zone_name, delivery_fee: z.delivery_fee, active: z.active,
      estimated_minutes: z.estimated_minutes,
      min_delivery_minutes: z.min_delivery_minutes ?? 45,
      max_delivery_minutes: z.max_delivery_minutes ?? 60,
      free_delivery_above: z.free_delivery_above,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.neighborhood.trim()) { Alert.alert('Informe o bairro'); return; }
    setSaving(true);
    try {
      const query = editing
        ? supabase.from('delivery_zones').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
        : supabase.from('delivery_zones').insert(form);
      const { error } = await query;
      if (error) throw error;
      setShowForm(false);
      await load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (z: DeliveryZone) => {
    Alert.alert('Excluir bairro', `Excluir "${z.neighborhood}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('delivery_zones').delete().eq('id', z.id);
          if (error) {
            Alert.alert('Erro', error.message);
            return;
          }
          await load();
        },
      },
    ]);
  };

  const filtered = zones.filter((z) =>
    z.neighborhood.toLowerCase().includes(search.toLowerCase()) ||
    (z.city || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner message="Carregando zonas..." />;

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TextInput style={s.searchBar} value={search} onChangeText={setSearch}
          placeholder="Buscar bairro..." placeholderTextColor={Colors.adminTextMuted} />
        <Button label="Novo bairro" onPress={openNew} fullWidth />
        {loadError ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{loadError}</Text>
            <Pressable onPress={load} style={s.retryBtn}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {!loadError && filtered.length === 0 ? (
          <View style={s.empty}>
            <MapPin size={40} color={Colors.adminTextMuted} />
            <Text style={s.emptyText}>
              {search ? 'Nenhum resultado.' : 'Nenhum bairro cadastrado.'}
            </Text>
          </View>
        ) : null}
        {filtered.map((z) => (
          <View key={z.id} style={[s.card, !z.active && s.cardOff]}>
            <View style={s.zoneHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.zoneName}>{z.neighborhood}</Text>
                {z.city ? <Text style={s.zoneSub}>{z.city}{z.state ? ` - ${z.state}` : ''}</Text> : null}
                {z.zone_name ? <Text style={s.zoneSub}>Zona: {z.zone_name}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.fee}>R$ {Number(z.delivery_fee).toFixed(2).replace('.', ',')}</Text>
                <Text style={s.eta}>{z.min_delivery_minutes ?? 45}–{z.max_delivery_minutes ?? 60} min</Text>
              </View>
            </View>
            <View style={s.zoneFooter}>
              <View style={[s.badge, z.active ? s.badgeOn : s.badgeOff]}>
                <Text style={[s.badgeText, z.active ? s.badgeTextOn : s.badgeTextOff]}>
                  {z.active ? 'Ativo' : 'Inativo'}
                </Text>
              </View>
              {z.free_delivery_above ? (
                <Text style={s.freeDelivery}>
                  Grátis acima de R$ {Number(z.free_delivery_above).toFixed(2).replace('.', ',')}
                </Text>
              ) : null}
              <View style={s.actions}>
                <Pressable style={s.editBtn} onPress={() => openEdit(z)}>
                  <Edit2 size={16} color={Colors.primary} />
                </Pressable>
                <Pressable style={s.deleteBtn} onPress={() => handleDelete(z)}>
                  <Trash2 size={16} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView style={s.sheet} contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}>
            <Text style={s.modalTitle}>{editing ? 'Editar bairro' : 'Novo bairro'}</Text>
            <Field label="Bairro *"><TextInput style={s.input} value={form.neighborhood}
              onChangeText={(v) => setForm(f => ({ ...f, neighborhood: v }))}
              placeholder="Ex: Centro" placeholderTextColor={Colors.textMuted} /></Field>
            <Field label="Cidade"><TextInput style={s.input} value={form.city ?? ''}
              onChangeText={(v) => setForm(f => ({ ...f, city: v }))}
              placeholder="Ex: Cidade Demo" placeholderTextColor={Colors.textMuted} /></Field>
            <Field label="Estado"><TextInput style={s.input} value={form.state ?? 'PR'}
              onChangeText={(v) => setForm(f => ({ ...f, state: v }))}
              placeholder="Ex: PR" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" /></Field>
            <Field label="Nome da zona (opcional)"><TextInput style={s.input} value={form.zone_name ?? ''}
              onChangeText={(v) => setForm(f => ({ ...f, zone_name: v || null }))}
              placeholder="Ex: Zona Norte" placeholderTextColor={Colors.textMuted} /></Field>
            <Field label="Taxa de entrega (R$)"><TextInput style={s.input}
              value={form.delivery_fee > 0 ? String(form.delivery_fee) : ''}
              onChangeText={(v) => setForm(f => ({ ...f, delivery_fee: parseFloat(v) || 0 }))}
              keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.textMuted} /></Field>
            <View style={s.row2}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.fieldLabel}>Mín (min)</Text>
                <TextInput style={s.input} value={String(form.min_delivery_minutes ?? 45)}
                  onChangeText={(v) => setForm(f => ({ ...f, min_delivery_minutes: parseInt(v) || 45 }))}
                  keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.fieldLabel}>Máx (min)</Text>
                <TextInput style={s.input} value={String(form.max_delivery_minutes ?? 60)}
                  onChangeText={(v) => setForm(f => ({ ...f, max_delivery_minutes: parseInt(v) || 60 }))}
                  keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>
            <Field label="Entrega grátis acima de (R$, vazio = sem limite)">
              <TextInput style={s.input} value={form.free_delivery_above ? String(form.free_delivery_above) : ''}
                onChangeText={(v) => setForm(f => ({ ...f, free_delivery_above: v ? parseFloat(v) : null }))}
                keyboardType="decimal-pad" placeholder="Ex: 100.00" placeholderTextColor={Colors.textMuted} />
            </Field>
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Ativo</Text>
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
    </>
  );
}

// ─── Hours Tab ───────────────────────────────────────────────────────────────

function HoursTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsService.getAll()
      .then((all) => {
        const m: Record<string, string> = {};
        all.forEach((setting) => { m[setting.key] = setting.value; });
        if (!m['store_open_time']) m['store_open_time'] = '07:00';
        if (!m['store_close_time']) m['store_close_time'] = '20:00';
        if (!m['delivery_open_time']) m['delivery_open_time'] = '08:00';
        if (!m['delivery_close_time']) m['delivery_close_time'] = '18:00';
        if (!m['pickup_open_time']) m['pickup_open_time'] = '08:00';
        if (!m['pickup_close_time']) m['pickup_close_time'] = '20:00';
        if (!m['store_open_days']) m['store_open_days'] = '1,2,3,4,5,6';
        setValues(m);
      })
      .catch((e: any) => Alert.alert('Erro', e?.message || 'Falha ao carregar horários.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await settingsService.update(key, values[key] ?? '');
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setSaving(null); }
  };

  const toggleDay = async (dayKey: string) => {
    const current = (values['store_open_days'] ?? '').split(',').filter(Boolean);
    const idx = current.indexOf(dayKey);
    const next = idx >= 0 ? current.filter((d) => d !== dayKey) : [...current, dayKey].sort();
    const newVal = next.join(',');
    setValues((v) => ({ ...v, store_open_days: newVal }));
    try {
      await settingsService.update('store_open_days', newVal);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar os dias.');
    }
  };

  if (loading) return <LoadingSpinner message="Carregando horários..." />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Days */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Dias de funcionamento</Text>
        <View style={s.daysRow}>
          {DAYS.map((d) => {
            const active = (values['store_open_days'] ?? '').split(',').includes(d.key);
            return (
              <Pressable key={d.key} style={[s.dayBtn, active && s.dayBtnActive]} onPress={() => toggleDay(d.key)}>
                <Text style={[s.dayBtnText, active && s.dayBtnTextActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Time pairs */}
      {[
        { title: 'Mercado', keys: ['store_open_time', 'store_close_time'], TabIcon: Store },
        { title: 'Entrega', keys: ['delivery_open_time', 'delivery_close_time'], TabIcon: Truck },
        { title: 'Retirada', keys: ['pickup_open_time', 'pickup_close_time'], TabIcon: ShoppingBag },
      ].map((group) => (
        <View key={group.title} style={s.card}>
          <View style={s.cardHeader}>
            <group.TabIcon size={18} color={Colors.primary} />
            <Text style={s.cardTitle}>{group.title}</Text>
          </View>
          <View style={s.row2}>
            {group.keys.map((key) => (
              <View key={key} style={{ flex: 1, gap: 6 }}>
                <Text style={s.fieldLabel}>{key.includes('open') ? 'Abertura' : 'Fechamento'}</Text>
                <View style={s.timeRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={values[key] ?? ''}
                    onChangeText={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Pressable style={s.saveTimeBtn} onPress={() => handleSave(key)} disabled={saving === key}>
                    {saved === key
                      ? <Check size={16} color={Colors.success} />
                      : saving === key
                        ? <Clock size={16} color="#fff" />
                        : <Check size={16} color="#fff" />
                    }
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Options Tab ─────────────────────────────────────────────────────────────

function OptionsTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const SETTINGS = [
    { key: 'delivery_enabled', label: 'Entregas ativas', type: 'bool' as const },
    { key: 'pickup_enabled', label: 'Retiradas ativas', type: 'bool' as const },
    { key: 'min_order_value', label: 'Pedido mínimo (R$)', type: 'text' as const, numeric: true },
    { key: 'delivery_min_minutes', label: 'Prazo mínimo entrega (min)', type: 'text' as const, numeric: true },
    { key: 'delivery_max_minutes', label: 'Prazo máximo entrega (min)', type: 'text' as const, numeric: true },
    { key: 'pickup_min_minutes', label: 'Prazo mínimo retirada (min)', type: 'text' as const, numeric: true },
    { key: 'pickup_max_minutes', label: 'Prazo máximo retirada (min)', type: 'text' as const, numeric: true },
    { key: 'pickup_address', label: 'Endereço de retirada', type: 'text' as const },
    { key: 'pickup_instructions', label: 'Instruções de retirada', type: 'text' as const },
    { key: 'unavailability_message', label: 'Mensagem de indisponibilidade', type: 'text' as const },
    { key: 'high_demand_message', label: 'Mensagem de alta demanda', type: 'text' as const },
    { key: 'free_delivery_above', label: 'Entrega grátis acima de (R$, 0 = desativado)', type: 'text' as const, numeric: true },
  ];

  useEffect(() => {
    settingsService.getAll()
      .then((all) => {
        const m: Record<string, string> = {};
        all.forEach((setting) => { m[setting.key] = setting.value; });
        setValues(m);
      })
      .catch((e: any) => Alert.alert('Erro', e?.message || 'Falha ao carregar configurações.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleBool = async (key: string) => {
    const previous = values[key] ?? 'false';
    const newVal = previous === 'true' ? 'false' : 'true';
    setValues((v) => ({ ...v, [key]: newVal }));
    try {
      await settingsService.update(key, newVal);
    } catch (e: any) {
      setValues((v) => ({ ...v, [key]: previous }));
      Alert.alert('Erro', e?.message || 'Não foi possível salvar a configuração.');
    }
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await settingsService.update(key, values[key] ?? '');
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setSaving(null); }
  };

  if (loading) return <LoadingSpinner message="Carregando configurações..." />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.card}>
        {SETTINGS.map((setting, idx) => (
          <View key={setting.key}>
            {setting.type === 'bool' ? (
              <View style={[s.settingRow, s.boolRow]}>
                <Text style={s.settingLabel}>{setting.label}</Text>
                <Switch
                  value={values[setting.key] === 'true'}
                  onValueChange={() => toggleBool(setting.key)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            ) : (
              <View style={s.settingRow}>
                <View style={s.labelRow}>
                  <Text style={s.settingLabel}>{setting.label}</Text>
                  {saved === setting.key ? (
                    <View style={s.savedBadge}>
                      <Check size={12} color={Colors.success} />
                      <Text style={s.savedText}>Salvo</Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.timeRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={values[setting.key] ?? ''}
                    onChangeText={(v) => setValues((prev) => ({ ...prev, [setting.key]: v }))}
                    keyboardType={(setting as any).numeric ? 'decimal-pad' : 'default'}
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Pressable style={s.saveTimeBtn} onPress={() => handleSave(setting.key)} disabled={saving === setting.key}>
                    <Check size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
            )}
            {idx < SETTINGS.length - 1 ? <View style={s.divider} /> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Field helper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AdminDeliveryScreen() {
  const [tab, setTab] = useState<Tab>('zones');

  const TABS: { key: Tab; label: string; TabIcon: any }[] = [
    { key: 'zones', label: 'Bairros', TabIcon: MapPin },
    { key: 'hours', label: 'Horários', TabIcon: Clock },
    { key: 'options', label: 'Configurações', TabIcon: Store },
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
      {tab === 'zones' ? <ZonesTab /> : null}
      {tab === 'hours' ? <HoursTab /> : null}
      {tab === 'options' ? <OptionsTab /> : null}
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
  searchBar: {
    height: 44, borderWidth: 1, borderColor: Colors.adminBorder, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.adminText,
    backgroundColor: Colors.adminSurface,
  },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  errorBox: {
    backgroundColor: Colors.errorSurface, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.error + '55', gap: Spacing.sm,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm },
  retryBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  retryText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardOff: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  zoneHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  zoneFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  zoneName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  zoneSub: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  fee: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
  eta: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  freeDelivery: { fontSize: FontSize.xs, color: Colors.success },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeOn: { backgroundColor: Colors.successSurface },
  badgeOff: { backgroundColor: Colors.borderLight },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextOn: { color: Colors.success },
  badgeTextOff: { color: Colors.adminTextMuted },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginLeft: 'auto' as any },
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
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  row2: { flexDirection: 'row', gap: Spacing.md },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
  daysRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dayBtn: {
    width: 44, height: 38, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.adminBorder,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.adminBackground,
  },
  dayBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.adminTextMuted },
  dayBtnTextActive: { color: '#fff' },
  timeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  saveTimeBtn: {
    width: 44, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  settingRow: { paddingVertical: 6, gap: Spacing.sm },
  boolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.adminText },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successSurface, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  savedText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },
  divider: { height: 1, backgroundColor: Colors.adminBorder },
});
