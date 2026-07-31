import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, Alert, Switch,
} from 'react-native';
import {
  Users, UserPlus, UserMinus, Search, Settings2, ToggleLeft, ToggleRight,
  ShieldAlert, Info, CheckCircle, RefreshCw,
} from 'lucide-react-native';
import { operatorsService } from '@/services/operators';
import { Profile, OperatorPermissions } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/constants/theme';

type Tab = 'list' | 'search';

const PERM_LABELS: { key: keyof OperatorPermissions; label: string }[] = [
  { key: 'can_accept_orders',           label: 'Aceitar pedidos' },
  { key: 'can_refuse_orders',           label: 'Recusar pedidos' },
  { key: 'can_cancel_orders',           label: 'Cancelar pedidos' },
  { key: 'can_change_eta',              label: 'Alterar previsão' },
  { key: 'can_weigh_items',             label: 'Realizar pesagem' },
  { key: 'can_mark_ready',              label: 'Marcar pedido pronto' },
  { key: 'can_complete_delivery',       label: 'Concluir entrega' },
  { key: 'can_complete_pickup',         label: 'Concluir retirada' },
  { key: 'can_remove_unavailable_item', label: 'Remover item indisponível' },
  { key: 'can_propose_substitution',    label: 'Propor substituição' },
];

export default function AdminOperatorsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('list');
  const [operators, setOperators] = useState<(Profile & { permissions?: OperatorPermissions })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Search
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Profile | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Permissions modal
  const [permModal, setPermModal] = useState<{
    visible: boolean;
    operator: Profile & { permissions?: OperatorPermissions };
  } | null>(null);
  const [permValues, setPermValues] = useState<Partial<OperatorPermissions>>({});
  const [savingPerms, setSavingPerms] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await operatorsService.getAll();
      setOperators(result);
    } catch (e: any) {
      setLoadError(e?.message || 'Erro ao carregar operadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async () => {
    const email = searchEmail.trim();
    if (!email) {
      Alert.alert('Atenção', 'Digite um e-mail para pesquisar.');
      return;
    }
    setSearching(true);
    setFound(null);
    setPromoteResult(null);
    try {
      const result = await operatorsService.searchByEmail(email);
      if (!result) {
        Alert.alert('Não encontrado', 'Não encontramos uma conta cadastrada com este e-mail.');
        return;
      }
      if (result.role === 'operator') {
        Alert.alert('Atenção', 'Esta conta já possui acesso de operador.');
        return;
      }
      if (result.role === 'admin') {
        Alert.alert('Atenção', 'Esta conta já é administradora.');
        return;
      }
      setFound(result);
    } catch (e: any) {
      Alert.alert('Erro ao buscar usuário', e?.message || 'Não foi possível consultar o usuário.');
    } finally {
      setSearching(false);
    }
  };

  const handlePromote = async () => {
    if (!found) return;
    setPromoting(true);
    setPromoteResult(null);
    try {
      const errMsg = await operatorsService.promoteToOperatorByEmail(found.email || '');
      if (errMsg) {
        setPromoteResult({ ok: false, msg: errMsg });
        return;
      }
      // Confirm the change was saved by re-querying
      const verify = await operatorsService.searchByEmail(found.email || '');
      if (!verify || verify.role !== 'operator') {
        setPromoteResult({ ok: false, msg: 'A promoção não foi confirmada no banco de dados. Tente novamente.' });
        return;
      }
      setPromoteResult({ ok: true, msg: 'Operador adicionado com sucesso.' });
      setFound(null);
      setSearchEmail('');
      // Reload list first, then switch tab
      await load();
      setTab('list');
    } catch (e: any) {
      setPromoteResult({ ok: false, msg: e?.message || 'Não foi possível adicionar o operador.' });
    } finally {
      setPromoting(false);
    }
  };

  const handleDemote = (op: Profile) => {
    Alert.alert(
      'Remover operador',
      `Remover a função de operador de "${op.full_name || op.email}"? A conta voltará a ser cliente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const errMsg = await operatorsService.demoteOperatorByEmail(op.email || '');
            if (errMsg) {
              Alert.alert('Erro', errMsg);
            } else {
              await load();
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (op: Profile) => {
    if (!user) return;
    try {
      await operatorsService.setActive(op.id, !op.active, user.id);
      // Optimistic update
      setOperators((prev) =>
        prev.map((o) => (o.id === op.id ? { ...o, active: !op.active } : o))
      );
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  const openPerms = (op: Profile & { permissions?: OperatorPermissions }) => {
    setPermValues(op.permissions || {});
    setPermModal({ visible: true, operator: op });
  };

  const handleSavePerms = async () => {
    if (!permModal || !user) return;
    setSavingPerms(true);
    try {
      await operatorsService.updatePermissions(permModal.operator.id, permValues, user.id);
      setPermModal(null);
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSavingPerms(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'list',   label: 'Operadores' },
    { key: 'search', label: 'Adicionar operador' },
  ];

  return (
    <View style={st.root}>
      {/* Tab bar */}
      <View style={st.tabBar}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[st.tabBtn, tab === t.key && st.tabBtnActive]}
            onPress={() => {
              setPromoteResult(null);
              setFound(null);
              setTab(t.key);
            }}
          >
            {t.key === 'list'
              ? <Users size={16} color={tab === t.key ? Colors.primary : Colors.adminTextMuted} />
              : <UserPlus size={16} color={tab === t.key ? Colors.primary : Colors.adminTextMuted} />
            }
            <Text style={[st.tabLabel, tab === t.key && st.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── LIST TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'list' ? (
        loading ? <LoadingSpinner fullScreen message="Carregando operadores..." /> : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.listHeader}>
              <Text style={s.pageTitle}>Operadores ({operators.length})</Text>
              <Pressable style={s.refreshBtn} onPress={load} hitSlop={8}>
                <RefreshCw size={16} color={Colors.adminTextMuted} />
              </Pressable>
            </View>

            {loadError ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{loadError}</Text>
                <Pressable onPress={load} style={s.retryBtn}>
                  <Text style={s.retryText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}

            {!loadError && operators.length === 0 ? (
              <View style={s.empty}>
                <Users size={52} color={Colors.adminTextMuted} />
                <Text style={s.emptyTitle}>Nenhum operador cadastrado</Text>
                <Text style={s.emptyText}>
                  Use a aba “Adicionar operador” para pesquisar um usuário pelo e-mail e promovê-lo a operador.
                </Text>
              </View>
            ) : null}

            {operators.map((op) => (
              <View key={op.id} style={s.card}>
                <View style={s.opHeader}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>
                      {(op.full_name || op.email || 'O')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.opName}>{op.full_name || 'Sem nome'}</Text>
                    <Text style={s.opEmail}>{op.email}</Text>
                  </View>
                  <View style={[s.badge, op.active ? s.badgeOn : s.badgeOff]}>
                    <Text style={[s.badgeText, op.active ? s.badgeTextOn : s.badgeTextOff]}>
                      {op.active ? 'Ativo' : 'Inativo'}
                    </Text>
                  </View>
                </View>

                <View style={s.opActions}>
                  <Pressable style={s.actionBtn} onPress={() => handleToggleActive(op)}>
                    {op.active
                      ? <ToggleRight size={16} color={Colors.success} />
                      : <ToggleLeft  size={16} color={Colors.adminTextMuted} />
                    }
                    <Text style={s.actionBtnText}>{op.active ? 'Desativar' : 'Ativar'}</Text>
                  </Pressable>
                  <Pressable style={s.actionBtn} onPress={() => openPerms(op)}>
                    <Settings2 size={16} color={Colors.primary} />
                    <Text style={[s.actionBtnText, { color: Colors.primary }]}>Permissões</Text>
                  </Pressable>
                  <Pressable style={[s.actionBtn, s.actionBtnDanger]} onPress={() => handleDemote(op)}>
                    <UserMinus size={16} color={Colors.error} />
                    <Text style={[s.actionBtnText, { color: Colors.error }]}>Remover</Text>
                  </Pressable>
                </View>

                {op.permissions ? (
                  <View style={s.permSummary}>
                    <Text style={s.permSummaryTitle}>Permissões ativas:</Text>
                    <View style={s.permTags}>
                      {PERM_LABELS
                        .filter((p) => op.permissions?.[p.key as keyof OperatorPermissions] === true)
                        .map((p) => (
                          <View key={p.key} style={s.permTag}>
                            <Text style={s.permTagText}>{p.label}</Text>
                          </View>
                        ))
                      }
                    </View>
                  </View>
                ) : (
                  <Text style={s.noPermsText}>Nenhuma permissão configurada ainda.</Text>
                )}
              </View>
            ))}
          </ScrollView>
        )
      ) : null}

      {/* ── SEARCH / ADD TAB ──────────────────────────────────────────────────── */}
      {tab === 'search' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>
            <Text style={s.cardTitle}>Adicionar operador</Text>
            <Text style={s.cardSub}>
              Digite o e-mail de um usuário já cadastrado no aplicativo. O operador não pode se cadastrar sozinho.
            </Text>

            <View style={s.searchRow}>
              <View style={[s.inputWrapper, { flex: 1 }]}>
                <Search size={16} color={Colors.adminTextMuted} />
                <TextInput
                  style={s.input}
                  value={searchEmail}
                  onChangeText={(v) => {
                    setSearchEmail(v);
                    setFound(null);
                    setPromoteResult(null);
                  }}
                  placeholder="E-mail do usuário"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onSubmitEditing={handleSearch}
                />
              </View>
              <Button label="Buscar" onPress={handleSearch} loading={searching} />
            </View>

            {/* Result message */}
            {promoteResult ? (
              <View style={[s.resultBox, promoteResult.ok ? s.resultOk : s.resultErr]}>
                <Text style={[s.resultText, promoteResult.ok ? s.resultTextOk : s.resultTextErr]}>
                  {promoteResult.msg}
                </Text>
              </View>
            ) : null}

            {found ? (
              <View style={s.foundCard}>
                <View style={s.foundHeader}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>
                      {(found.full_name || found.email || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.opName}>{found.full_name || 'Sem nome'}</Text>
                    <Text style={s.opEmail}>{found.email}</Text>
                    <Text style={[s.opEmail, { marginTop: 2 }]}>Função atual: {found.role}</Text>
                  </View>
                  <CheckCircle size={20} color={Colors.success} />
                </View>

                <View style={s.infoBox}>
                  <Info size={14} color={Colors.info} />
                  <Text style={s.infoText}>
                    Este usuário será promovido a operador com as permissões padrão. As permissões podem ser ajustadas depois.
                  </Text>
                </View>

                <Button
                  label={promoting ? 'Salvando...' : 'Adicionar operador'}
                  onPress={handlePromote}
                  loading={promoting}
                  fullWidth
                />
              </View>
            ) : null}
          </View>

          <View style={s.infoBox}>
            <ShieldAlert size={14} color={Colors.warning} />
            <Text style={s.infoText}>
              Operadores têm acesso apenas à área operacional (/operator). Eles não podem acessar o painel
              administrativo, editar produtos, preços, taxas ou configurações.
            </Text>
          </View>
        </ScrollView>
      ) : null}

      {/* ── PERMISSIONS MODAL ─────────────────────────────────────────────────── */}
      <Modal visible={!!permModal?.visible} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView
            style={s.sheet}
            contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}
          >
            <Text style={s.modalTitle}>
              Permissões: {permModal?.operator.full_name || permModal?.operator.email}
            </Text>
            {PERM_LABELS.map(({ key, label }) => (
              <View key={key} style={s.permRow}>
                <Text style={s.permLabel}>{label}</Text>
                <Switch
                  value={(permValues[key as keyof OperatorPermissions] as boolean) ?? false}
                  onValueChange={(v) => setPermValues((p) => ({ ...p, [key]: v }))}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            ))}
            <View style={s.formBtns}>
              <Button label="Cancelar" variant="outline" onPress={() => setPermModal(null)} />
              <Button label="Salvar permissões" onPress={handleSavePerms} loading={savingPerms} />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
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

const s = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.adminText },
  refreshBtn: {
    padding: 8, borderRadius: Radius.md,
    backgroundColor: Colors.adminSurface, borderWidth: 1, borderColor: Colors.adminBorder,
  },
  errorBox: {
    backgroundColor: Colors.errorSurface, borderRadius: Radius.md,
    padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  retryBtn: {
    alignSelf: 'flex-start', backgroundColor: Colors.error + '22',
    borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 6,
  },
  retryText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.semibold },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.adminText },
  emptyText: {
    fontSize: FontSize.sm, color: Colors.adminTextMuted,
    textAlign: 'center', lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.adminSurface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.adminText },
  cardSub: { fontSize: FontSize.sm, color: Colors.adminTextMuted, lineHeight: 20 },
  opHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  opName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.adminText },
  opEmail: { fontSize: FontSize.xs, color: Colors.adminTextMuted },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  badgeOn: { backgroundColor: Colors.successSurface },
  badgeOff: { backgroundColor: Colors.errorSurface },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  badgeTextOn: { color: Colors.success },
  badgeTextOff: { color: Colors.error },
  opActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.adminBackground, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  actionBtnDanger: { borderColor: Colors.errorSurface },
  actionBtnText: { fontSize: FontSize.xs, color: Colors.adminText, fontWeight: FontWeight.medium },
  permSummary: { gap: 6 },
  permSummaryTitle: { fontSize: FontSize.xs, color: Colors.adminTextMuted, fontWeight: FontWeight.semibold },
  permTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  permTag: {
    backgroundColor: Colors.primary + '15', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  permTagText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  noPermsText: { fontSize: FontSize.xs, color: Colors.adminTextMuted, fontStyle: 'italic' },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 48, borderWidth: 1.5, borderColor: Colors.adminBorder, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.adminBackground,
  },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.adminText },
  resultBox: {
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1,
  },
  resultOk: { backgroundColor: Colors.successSurface, borderColor: Colors.success + '44' },
  resultErr: { backgroundColor: Colors.errorSurface, borderColor: Colors.error + '44' },
  resultText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  resultTextOk: { color: Colors.success },
  resultTextErr: { color: Colors.error },
  foundCard: {
    backgroundColor: Colors.adminBackground, borderRadius: Radius.md,
    padding: Spacing.md, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.adminBorder,
  },
  foundHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  infoBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.infoSurface, borderRadius: Radius.md, padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    flex: 1, backgroundColor: Colors.surface,
    marginTop: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  permRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 4,
  },
  permLabel: { fontSize: FontSize.md, color: Colors.textPrimary },
  formBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', paddingBottom: 20 },
});
