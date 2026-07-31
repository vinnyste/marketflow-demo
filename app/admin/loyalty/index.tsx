import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Switch,
} from 'react-native';
import { DollarSign, ShoppingBag, Info, Users, SlidersHorizontal, Gift, Edit2, Trash2, Settings, Star } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { loyaltyService } from '@/services/loyalty';
import { settingsService } from '@/services/settings';
import { LoyaltyAccount, LoyaltyReward, LoyaltyRewardType } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

type Tab = 'settings' | 'customers' | 'rewards';

const DEFAULT_LOYALTY_SETTINGS = {
  loyalty_enabled: 'true',
  loyalty_mode: 'per_value',
  loyalty_brl_per_point: '1',
  loyalty_min_order_value: '0',
  loyalty_points_per_order: '10',
  loyalty_points_validity_days: '0',
};

const REWARD_TYPE_LABELS: Record<LoyaltyRewardType, string> = {
  discount_flat: 'Desconto em R$',
  discount_percent: 'Desconto em %',
  free_product: 'Produto grátis',
  custom: 'Benefício personalizado',
};

const REWARD_TYPE_ICONS: Record<LoyaltyRewardType, LucideIcon> = {
  discount_flat: DollarSign,
  discount_percent: SlidersHorizontal,
  free_product: Gift,
  custom: Star,
};

// ─── Settings tab ────────────────────────────────────────────────────────────

function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_LOYALTY_SETTINGS);

  useEffect(() => {
    const keys = Object.keys(DEFAULT_LOYALTY_SETTINGS);
    settingsService.getAll().then((all) => {
      const updated: Record<string, string> = { ...DEFAULT_LOYALTY_SETTINGS };
      all.forEach((s) => { if (keys.includes(s.key)) updated[s.key] = s.value; });
      setSettings(updated as typeof settings);
      setLoading(false);
    });
  }, []);

  const save = async (key: string, value: string) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated as typeof settings);
    setSaving(true);
    try {
      await settingsService.update(key, value);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Carregando configurações..." />;

  const enabled = settings.loyalty_enabled === 'true';
  const mode = settings.loyalty_mode;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={sStyles.content} showsVerticalScrollIndicator={false}>
      {/* Toggle */}
      <View style={sStyles.card}>
        <View style={sStyles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={sStyles.cardTitle}>Clube MarketFlow</Text>
            <Text style={sStyles.cardSub}>
              {enabled ? 'Ativo — clientes acumulam pontos' : 'Inativo — pontos não são gerados'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(v) => save('loyalty_enabled', v ? 'true' : 'false')}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.textOnPrimary}
          />
        </View>
      </View>

      {enabled ? (
        <>
          {/* Mode selector */}
          <View style={sStyles.card}>
            <Text style={sStyles.cardTitle}>Modo de pontuação</Text>
            <View style={sStyles.modeRow}>
              <Pressable
                style={[sStyles.modeBtn, mode === 'per_value' && sStyles.modeBtnActive]}
                onPress={() => save('loyalty_mode', 'per_value')}
              >
                <DollarSign
                  size={22}
                  color={mode === 'per_value' ? Colors.primary : Colors.adminTextMuted}
                />
                <Text style={[sStyles.modeBtnLabel, mode === 'per_value' && sStyles.modeBtnLabelActive]}>
                  Por valor gasto
                </Text>
                <Text style={[sStyles.modeBtnSub, mode === 'per_value' && sStyles.modeBtnSubActive]}>
                  1 ponto a cada R$ {settings.loyalty_brl_per_point}
                </Text>
              </Pressable>
              <Pressable
                style={[sStyles.modeBtn, mode === 'per_order' && sStyles.modeBtnActive]}
                onPress={() => save('loyalty_mode', 'per_order')}
              >
                <ShoppingBag
                  size={22}
                  color={mode === 'per_order' ? Colors.primary : Colors.adminTextMuted}
                />
                <Text style={[sStyles.modeBtnLabel, mode === 'per_order' && sStyles.modeBtnLabelActive]}>
                  Por pedido
                </Text>
                <Text style={[sStyles.modeBtnSub, mode === 'per_order' && sStyles.modeBtnSubActive]}>
                  {settings.loyalty_points_per_order} pts por pedido
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Rule fields */}
          <View style={sStyles.card}>
            <Text style={sStyles.cardTitle}>Regras de pontuação</Text>
            {mode === 'per_value' ? (
              <LabeledInput
                label="Reais por ponto (ex: 5 = a cada R$5 o cliente ganha 1 ponto)"
                value={settings.loyalty_brl_per_point}
                onChangeText={(v) => setSettings((s) => ({ ...s, loyalty_brl_per_point: v }))}
                onBlur={() => save('loyalty_brl_per_point', settings.loyalty_brl_per_point)}
                keyboardType="numeric"
              />
            ) : (
              <LabeledInput
                label="Pontos por pedido concluído"
                value={settings.loyalty_points_per_order}
                onChangeText={(v) => setSettings((s) => ({ ...s, loyalty_points_per_order: v }))}
                onBlur={() => save('loyalty_points_per_order', settings.loyalty_points_per_order)}
                keyboardType="numeric"
              />
            )}
            <LabeledInput
              label="Valor mínimo do pedido para pontuar (R$)"
              value={settings.loyalty_min_order_value}
              onChangeText={(v) => setSettings((s) => ({ ...s, loyalty_min_order_value: v }))}
              onBlur={() => save('loyalty_min_order_value', settings.loyalty_min_order_value)}
              keyboardType="decimal-pad"
            />
            <LabeledInput
              label="Validade dos pontos em dias (0 = sem validade)"
              value={settings.loyalty_points_validity_days}
              onChangeText={(v) => setSettings((s) => ({ ...s, loyalty_points_validity_days: v }))}
              onBlur={() => save('loyalty_points_validity_days', settings.loyalty_points_validity_days)}
              keyboardType="numeric"
            />
            <View style={sStyles.infoBox}>
              <Info size={14} color={Colors.info} />
              <Text style={sStyles.infoText}>
                Pontos são liberados somente quando o pedido for concluído. Pedidos cancelados ou recusados não geram pontos.
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {saving ? (
        <View style={sStyles.savingRow}>
          <Settings size={14} color={Colors.adminTextMuted} />
          <Text style={sStyles.savingText}>Salvando...</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function LabeledInput({
  label, value, onChangeText, onBlur, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  keyboardType?: any;
}) {
  return (
    <View style={sStyles.fieldGroup}>
      <Text style={sStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={sStyles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        placeholderTextColor={Colors.adminTextMuted}
      />
    </View>
  );
}

const sStyles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  cardSub: { fontSize: FontSize.sm, color: Colors.adminTextMuted, marginTop: 2 },
  modeRow: { flexDirection: 'row', gap: Spacing.md },
  modeBtn: {
    flex: 1, alignItems: 'center', gap: 4, padding: Spacing.md,
    backgroundColor: Colors.adminBackground, borderRadius: Radius.md,
    borderWidth: 2, borderColor: 'transparent',
  },
  modeBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(201,168,76,0.08)' },
  modeBtnLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.adminTextMuted, textAlign: 'center' },
  modeBtnLabelActive: { color: Colors.primary },
  modeBtnSub: { fontSize: FontSize.xs, color: Colors.adminTextMuted, textAlign: 'center' },
  modeBtnSubActive: { color: Colors.primary },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
  fieldInput: {
    height: 44, borderWidth: 1, borderColor: Colors.adminBorder,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    fontSize: FontSize.md, color: Colors.adminText,
    backgroundColor: Colors.adminBackground,
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.infoSurface, borderRadius: Radius.sm, padding: Spacing.sm,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  savingText: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
});

// ─── Customers tab ───────────────────────────────────────────────────────────

function CustomersTab() {
  const [accounts, setAccounts] = useState<
    (LoyaltyAccount & { profile?: { full_name: string | null; email: string | null } })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState<{
    visible: boolean;
    customerId: string;
    name: string;
    balance: number;
  } | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loyaltyService.getAllAccounts();
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdjust = async () => {
    if (!adjustModal) return;
    const pts = parseInt(adjustPoints.replace(/\+/, ''), 10);
    if (isNaN(pts) || pts === 0) {
      Alert.alert('Pontos inválidos', 'Informe um valor inteiro diferente de zero. Use valores negativos para descontar.');
      return;
    }
    if (!adjustDesc.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo do ajuste.');
      return;
    }
    setSaving(true);
    try {
      await loyaltyService.adjustPoints(adjustModal.customerId, pts, adjustDesc.trim());
      setAdjustModal(null);
      setAdjustPoints('');
      setAdjustDesc('');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível ajustar os pontos.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Carregando clientes..." />;

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={cStyles.content} showsVerticalScrollIndicator={false}>
        {accounts.length === 0 ? (
          <View style={cStyles.empty}>
            <Users size={40} color={Colors.adminTextMuted} />
            <Text style={cStyles.emptyText}>Nenhum cliente com pontos ainda.</Text>
          </View>
        ) : null}
        {accounts.map((acc) => (
          <View key={acc.id} style={cStyles.row}>
            <View style={cStyles.avatar}>
              <Text style={cStyles.avatarText}>
                {(acc.profile?.full_name || 'C')[0].toUpperCase()}
              </Text>
            </View>
            <View style={cStyles.info}>
              <Text style={cStyles.name}>{acc.profile?.full_name || 'Cliente'}</Text>
              <Text style={cStyles.email}>{acc.profile?.email || ''}</Text>
            </View>
            <View style={cStyles.right}>
              <Text style={cStyles.pts}>{acc.points_balance.toLocaleString('pt-BR')}</Text>
              <Text style={cStyles.ptsSub}>pontos</Text>
            </View>
            <Pressable
              style={cStyles.adjustBtn}
              onPress={() =>
                setAdjustModal({
                  visible: true,
                  customerId: acc.customer_id,
                  name: acc.profile?.full_name || 'Cliente',
                  balance: acc.points_balance,
                })
              }
            >
              <SlidersHorizontal size={18} color={Colors.primary} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!adjustModal?.visible} transparent animationType="slide">
        <View style={cStyles.modalOverlay}>
          <View style={cStyles.modalBox}>
            <Text style={cStyles.modalTitle}>Ajustar pontos</Text>
            <Text style={cStyles.modalSub}>
              {adjustModal?.name} — saldo atual:{' '}
              <Text style={{ color: Colors.primary, fontWeight: FontWeight.bold }}>
                {adjustModal?.balance} pts
              </Text>
            </Text>
            <View style={cStyles.fieldGroup}>
              <Text style={cStyles.fieldLabel}>Pontos (use negativo para descontar)</Text>
              <TextInput
                style={cStyles.input}
                value={adjustPoints}
                onChangeText={setAdjustPoints}
                placeholder="Ex: 50 ou -20"
                keyboardType="numbers-and-punctuation"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={cStyles.fieldGroup}>
              <Text style={cStyles.fieldLabel}>Motivo *</Text>
              <TextInput
                style={[cStyles.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                value={adjustDesc}
                onChangeText={setAdjustDesc}
                placeholder="Ex: Correção manual, promoção especial..."
                multiline
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={cStyles.btnRow}>
              <Button
                label="Cancelar"
                variant="outline"
                onPress={() => { setAdjustModal(null); setAdjustPoints(''); setAdjustDesc(''); }}
              />
              <Button label="Confirmar ajuste" onPress={handleAdjust} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const cStyles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  info: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  email: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  right: { alignItems: 'flex-end' },
  pts: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  ptsSub: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  adjustBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.adminSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xl, gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.adminText },
  modalSub: { fontSize: FontSize.sm, color: Colors.adminTextMuted },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.adminBorder, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.adminText,
    backgroundColor: Colors.adminBackground,
  },
  btnRow: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end' },
});

// ─── Rewards tab ──────────────────────────────────────────────────────────────

const EMPTY_REWARD = (): Omit<LoyaltyReward, 'id' | 'created_at' | 'updated_at' | 'reward_product'> => ({
  name: '',
  description: '',
  points_required: 100,
  reward_type: 'discount_flat',
  reward_value: null,
  reward_product_id: null,
  valid_until: null,
  quantity_available: null,
  active: true,
});

function RewardsTab() {
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LoyaltyReward | null>(null);
  const [form, setForm] = useState(EMPTY_REWARD());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loyaltyService.getAllRewards();
      setRewards(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_REWARD());
    setShowForm(true);
  };

  const openEdit = (r: LoyaltyReward) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description,
      points_required: r.points_required,
      reward_type: r.reward_type,
      reward_value: r.reward_value,
      reward_product_id: r.reward_product_id,
      valid_until: r.valid_until,
      quantity_available: r.quantity_available,
      active: r.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Nome obrigatório', 'Informe o nome da recompensa.'); return; }
    if (form.points_required <= 0) { Alert.alert('Pontos inválidos', 'Informe um valor maior que zero.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await loyaltyService.updateReward(editing.id, form);
      } else {
        await loyaltyService.createReward(form);
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar a recompensa.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (r: LoyaltyReward) => {
    await loyaltyService.updateReward(r.id, { active: !r.active });
    await load();
  };

  const handleDelete = (r: LoyaltyReward) => {
    Alert.alert(
      'Excluir recompensa',
      `Deseja excluir "${r.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            await loyaltyService.deleteReward(r.id);
            await load();
          },
        },
      ]
    );
  };

  if (loading) return <LoadingSpinner message="Carregando recompensas..." />;

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={rStyles.content} showsVerticalScrollIndicator={false}>
        <Button label="Nova recompensa" onPress={openNew} fullWidth />

        {rewards.length === 0 ? (
          <View style={rStyles.empty}>
            <Gift size={40} color={Colors.adminTextMuted} />
            <Text style={rStyles.emptyText}>Nenhuma recompensa criada ainda.</Text>
          </View>
        ) : null}

        {rewards.map((r) => (
          <View key={r.id} style={[rStyles.card, !r.active && rStyles.cardInactive]}>
            <View style={rStyles.cardTop}>
              <View style={[rStyles.typeIcon, { backgroundColor: Colors.primary + '18' }]}>
                {(() => { const IconComp = REWARD_TYPE_ICONS[r.reward_type]; return <IconComp size={20} color={Colors.primary} />; })()}
              </View>
              <View style={rStyles.cardInfo}>
                <Text style={rStyles.cardName}>{r.name}</Text>
                <Text style={rStyles.cardType}>{REWARD_TYPE_LABELS[r.reward_type]}</Text>
              </View>
              <View style={rStyles.ptsTag}>
                <Text style={rStyles.ptsTagText}>{r.points_required} pts</Text>
              </View>
            </View>

            {r.description ? <Text style={rStyles.cardDesc}>{r.description}</Text> : null}

            {r.reward_value != null ? (
              <Text style={rStyles.cardValue}>
                {r.reward_type === 'discount_percent'
                  ? `${r.reward_value}% de desconto`
                  : `R$ ${r.reward_value.toFixed(2).replace('.', ',')} de desconto`}
              </Text>
            ) : null}

            <View style={rStyles.cardFooter}>
              <View style={rStyles.metaRow}>
                {r.quantity_available != null ? (
                  <Text style={rStyles.meta}>
                    Disponível: {r.quantity_available}
                  </Text>
                ) : <Text style={rStyles.meta}>Ilimitado</Text>}
                {r.valid_until ? (
                  <Text style={rStyles.meta}>
                    Válido até {new Date(r.valid_until).toLocaleDateString('pt-BR')}
                  </Text>
                ) : null}
              </View>
              <View style={rStyles.cardActions}>
                <Switch
                  value={r.active}
                  onValueChange={() => handleToggle(r)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.textOnPrimary}
                />
                <Pressable style={rStyles.editBtn} onPress={() => openEdit(r)}>
                  <Edit2 size={16} color={Colors.primary} />
                </Pressable>
                <Pressable style={rStyles.deleteBtn} onPress={() => handleDelete(r)}>
                  <Trash2 size={16} color={Colors.error} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Form Modal */}
      <Modal visible={showForm} transparent animationType="slide">
        <View style={rStyles.modalOverlay}>
          <ScrollView style={rStyles.modalScroll} contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}>
            <Text style={rStyles.modalTitle}>{editing ? 'Editar recompensa' : 'Nova recompensa'}</Text>

            <RField label="Nome *">
              <TextInput
                style={rStyles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Ex: Desconto de R$ 10"
                placeholderTextColor={Colors.textMuted}
              />
            </RField>

            <RField label="Descrição">
              <TextInput
                style={[rStyles.input, { height: 64, textAlignVertical: 'top', paddingTop: 10 }]}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Descrição opcional"
                multiline
                placeholderTextColor={Colors.textMuted}
              />
            </RField>

            <RField label="Tipo de recompensa">
              <View style={rStyles.typeGrid}>
                {(Object.keys(REWARD_TYPE_LABELS) as LoyaltyRewardType[]).map((t) => (
                    <Pressable
                    key={t}
                    style={[rStyles.typeBtn, form.reward_type === t && rStyles.typeBtnActive]}
                    onPress={() => setForm((f) => ({ ...f, reward_type: t }))}
                  >
                    {(() => { const IconComp = REWARD_TYPE_ICONS[t]; return <IconComp size={16} color={form.reward_type === t ? Colors.primary : Colors.textSecondary} />; })()}
                    <Text style={[rStyles.typeBtnText, form.reward_type === t && rStyles.typeBtnTextActive]}>
                      {REWARD_TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </RField>

            <RField label="Pontos necessários *">
              <TextInput
                style={rStyles.input}
                value={String(form.points_required)}
                onChangeText={(v) => setForm((f) => ({ ...f, points_required: parseInt(v) || 0 }))}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </RField>

            {(form.reward_type === 'discount_flat' || form.reward_type === 'discount_percent') ? (
              <RField
                label={form.reward_type === 'discount_percent' ? 'Porcentagem de desconto (%)' : 'Valor do desconto (R$)'}
              >
                <TextInput
                  style={rStyles.input}
                  value={form.reward_value != null ? String(form.reward_value) : ''}
                  onChangeText={(v) => setForm((f) => ({ ...f, reward_value: parseFloat(v) || null }))}
                  keyboardType="decimal-pad"
                  placeholder={form.reward_type === 'discount_percent' ? 'Ex: 15' : 'Ex: 10.00'}
                  placeholderTextColor={Colors.textMuted}
                />
              </RField>
            ) : null}

            <RField label="Quantidade disponível (vazio = ilimitado)">
              <TextInput
                style={rStyles.input}
                value={form.quantity_available != null ? String(form.quantity_available) : ''}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, quantity_available: v ? parseInt(v) : null }))
                }
                keyboardType="numeric"
                placeholder="Ilimitado"
                placeholderTextColor={Colors.textMuted}
              />
            </RField>

            <View style={rStyles.activeRow}>
              <Text style={rStyles.activeLabel}>Ativo</Text>
              <Switch
                value={form.active}
                onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.textOnPrimary}
              />
            </View>

            <View style={rStyles.formBtns}>
              <Button
                label="Cancelar"
                variant="outline"
                onPress={() => setShowForm(false)}
              />
              <Button label={editing ? 'Salvar' : 'Criar'} onPress={handleSave} loading={saving} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function RField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium }}>{label}</Text>
      {children}
    </View>
  );
}

const rStyles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyText: { fontSize: FontSize.md, color: Colors.adminTextMuted },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardInactive: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  typeIcon: {
    width: 40, height: 40, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  cardType: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  ptsTag: {
    backgroundColor: Colors.primary + '18', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  ptsTagText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  cardDesc: { fontSize: FontSize.sm, color: Colors.adminTextMuted, lineHeight: 18 },
  cardValue: { fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.medium },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flex: 1, gap: 2 },
  meta: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  editBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.errorSurface, alignItems: 'center', justifyContent: 'center',
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeBtn: {
    flexBasis: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: Spacing.sm, backgroundColor: Colors.background,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
  },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(201,168,76,0.08)' },
  typeBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium, flex: 1 },
  typeBtnTextActive: { color: Colors.primary },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalScroll: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.background,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AdminLoyaltyScreen() {
  const [tab, setTab] = useState<Tab>('settings');

  const TABS: { key: Tab; label: string; TabIcon: LucideIcon }[] = [
    { key: 'settings', label: 'Configurações', TabIcon: Settings },
    { key: 'customers', label: 'Clientes', TabIcon: Users },
    { key: 'rewards', label: 'Recompensas', TabIcon: Gift },
  ];

  return (
    <View style={main.root}>
      {/* Tab bar */}
      <View style={main.tabBar}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[main.tabBtn, tab === t.key && main.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <t.TabIcon
              size={18}
              color={tab === t.key ? Colors.primary : Colors.adminTextMuted}
            />
            <Text style={[main.tabLabel, tab === t.key && main.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'settings' ? <SettingsTab /> : null}
      {tab === 'customers' ? <CustomersTab /> : null}
      {tab === 'rewards' ? <RewardsTab /> : null}
    </View>
  );
}

const main = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminBackground },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.adminSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.adminBorder,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, color: Colors.adminTextMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
